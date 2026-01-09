import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

import { getConnection } from "../../../lib/rpc";
import { getSafeErrorMessage } from "../../../lib/safeError";
import { getUwuTransfer, mutateUwuTransfer } from "../../../lib/uwuTransferStore";
import type { UwuPrivyTransferData } from "../../../lib/uwuPrivyRouter";
import { getTreasuryWallet } from "../../../lib/uwuRouter";
import {
  findRecentSplTransferSignature,
  findRecentSystemTransferSignature,
  getTokenBalanceForMint,
  transferLamportsFromPrivyWallet,
  transferSplTokensFromPrivyWallet,
} from "../../../lib/solana";

export const runtime = "nodejs";

const IN_FLIGHT_STALE_MS = 120_000;

function mustHaveFeePayerConfigured(): void {
  const s = String(process.env.ESCROW_FEE_PAYER_SECRET_KEY ?? "").trim();
  if (!s) throw new Error("ESCROW_FEE_PAYER_SECRET_KEY is required for routing execution on Vercel");
}

async function reconcileStaleInFlight(opts: { connection: ReturnType<typeof getConnection>; id: string; data: UwuPrivyTransferData }): Promise<void> {
  const { connection, id } = opts;
  const current = opts.data;
  const inFlight = current?.state?.inFlight;
  if (!inFlight) return;

  const startedAt = Number(inFlight.startedAtUnixMs || 0);
  if (!Number.isFinite(startedAt)) return;
  if (Date.now() - startedAt < IN_FLIGHT_STALE_MS) return;

  const action = String(inFlight.action ?? "");
  const plan = current.plan;

  if (!plan?.burners?.length) {
    await mutateUwuTransfer<UwuPrivyTransferData>({
      id,
      mutate: (rec) => ({
        status: rec.status,
        data: { ...rec.data, state: { ...rec.data.state, inFlight: undefined } },
      }),
    });
    return;
  }

  if (action === "fee") {
    const treasury = getTreasuryWallet();
    const feeLamports = BigInt(plan.feeLamports || "0");
    if (!treasury || feeLamports <= 0n) {
      await mutateUwuTransfer<UwuPrivyTransferData>({
        id,
        mutate: (rec) => ({
          status: rec.status,
          data: { ...rec.data, state: { ...rec.data.state, inFlight: undefined, feeCollected: feeLamports <= 0n } },
        }),
      });
      return;
    }

    const burner0 = plan.burners[0];
    const from = new PublicKey(burner0.address);
    const sig =
      plan.asset === "SOL"
        ? await findRecentSystemTransferSignature({ connection, fromPubkey: from, toPubkey: treasury, lamports: Number(feeLamports), limit: 20 })
        : await findRecentSplTransferSignature({
            connection,
            fromOwner: from,
            toOwner: treasury,
            mint: new PublicKey((plan.asset as any).mint),
            amountRaw: feeLamports,
            limit: 20,
          });

    await mutateUwuTransfer<UwuPrivyTransferData>({
      id,
      mutate: (rec) => {
        const nextState = { ...rec.data.state, inFlight: undefined };
        if (sig) {
          nextState.feeCollected = true;
          nextState.feeSignature = sig;
        }
        return { status: rec.status, data: { ...rec.data, state: nextState } };
      },
    });
    return;
  }

  if (action.startsWith("hop:")) {
    const idx = Number(action.split(":")[1]);
    if (!Number.isFinite(idx) || idx < 0) {
      await mutateUwuTransfer<UwuPrivyTransferData>({
        id,
        mutate: (rec) => ({ status: rec.status, data: { ...rec.data, state: { ...rec.data.state, inFlight: undefined } } }),
      });
      return;
    }

    const hopCount = Number(plan.hopCount || 0);
    const netLamports = BigInt(plan.netAmountLamports || "0");

    if (idx >= hopCount) {
      await mutateUwuTransfer<UwuPrivyTransferData>({
        id,
        mutate: (rec) => ({ status: rec.status, data: { ...rec.data, state: { ...rec.data.state, inFlight: undefined } } }),
      });
      return;
    }

    const from = new PublicKey(plan.burners[idx].address);
    const to = idx === hopCount - 1 ? new PublicKey(plan.toWallet) : new PublicKey(plan.burners[idx + 1].address);

    const sig =
      plan.asset === "SOL"
        ? await findRecentSystemTransferSignature({ connection, fromPubkey: from, toPubkey: to, lamports: Number(netLamports), limit: 20 })
        : await findRecentSplTransferSignature({
            connection,
            fromOwner: from,
            toOwner: to,
            mint: new PublicKey((plan.asset as any).mint),
            amountRaw: netLamports,
            limit: 20,
          });

    await mutateUwuTransfer<UwuPrivyTransferData>({
      id,
      mutate: (rec) => {
        const d = rec.data;
        const s = { ...d.state, inFlight: undefined };

        if (sig) {
          const existing = Array.isArray(s.hopResults) ? s.hopResults : [];
          if (!existing.some((r) => r.index === idx && r.signature === sig)) {
            existing.push({ index: idx, signature: sig, success: true });
          }
          s.hopResults = existing;
          s.currentHop = Math.max(Number(s.currentHop || 0), idx + 1);

          if (s.currentHop >= hopCount) {
            s.finalSignature = sig;
            s.nextActionAtUnixMs = Date.now();
            return { status: "complete", data: { ...d, state: s } };
          }

          const delays = Array.isArray(d.plan.hopDelaysMs) ? d.plan.hopDelaysMs : [];
          s.nextActionAtUnixMs = Date.now() + Number(delays[s.currentHop] ?? 0);
        }

        return { status: rec.status, data: { ...d, state: s } };
      },
    });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const id = String(body?.id ?? "").trim();
  const fundingSignature = body?.fundingSignature != null ? String(body.fundingSignature).trim() : undefined;

  try {
    mustHaveFeePayerConfigured();

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const connection = getConnection();

    const rec = await getUwuTransfer<UwuPrivyTransferData>(id);
    if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await reconcileStaleInFlight({ connection, id, data: rec.data });

    const refreshed = await getUwuTransfer<UwuPrivyTransferData>(id);
    if (!refreshed) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = refreshed.data;
    const plan = data.plan;
    const state = data.state;

    if (state?.inFlight && Date.now() - Number(state.inFlight.startedAtUnixMs || 0) < IN_FLIGHT_STALE_MS) {
      return NextResponse.json({ ok: true, id, status: refreshed.status, inFlight: state.inFlight });
    }

    const amountLamports = BigInt(plan.amountLamports || "0");
    const feeLamports = BigInt(plan.feeLamports || "0");
    const netLamports = BigInt(plan.netAmountLamports || "0");

    if (refreshed.status === "complete" || refreshed.status === "failed") {
      return NextResponse.json({ ok: true, id, status: refreshed.status });
    }

    // Funding detection
    if (refreshed.status === "awaiting_funding" && !state.funded) {
      const burner0 = plan.burners?.[0];
      if (!burner0?.address) return NextResponse.json({ error: "Missing burner wallet" }, { status: 500 });

      const burner0Pubkey = new PublicKey(burner0.address);

      let funded = false;
      if (plan.asset === "SOL") {
        const bal = await connection.getBalance(burner0Pubkey, "confirmed");
        funded = BigInt(bal) >= amountLamports;
      } else {
        const mint = new PublicKey((plan.asset as any).mint);
        const bal = await getTokenBalanceForMint({ connection, owner: burner0Pubkey, mint });
        funded = bal.amountRaw >= amountLamports;
      }

      if (!funded) {
        return NextResponse.json({ ok: true, id, status: "awaiting_funding", funded: false });
      }

      const nextStatus = "routing" as const;
      const nextActionAt = Date.now() + Number(plan.hopDelaysMs?.[0] ?? 0);

      await mutateUwuTransfer<UwuPrivyTransferData>({
        id,
        mutate: (r) => ({
          status: nextStatus,
          data: {
            ...r.data,
            state: {
              ...r.data.state,
              funded: true,
              fundingSignature: fundingSignature || r.data.state.fundingSignature,
              nextActionAtUnixMs: nextActionAt,
            },
          },
        }),
      });

      return NextResponse.json({ ok: true, id, status: nextStatus, funded: true });
    }

    if (refreshed.status !== "routing") {
      return NextResponse.json({ ok: true, id, status: refreshed.status });
    }

    if (Date.now() < Number(state.nextActionAtUnixMs || 0)) {
      return NextResponse.json({ ok: true, id, status: "routing", waiting: true, nextActionAtUnixMs: state.nextActionAtUnixMs });
    }

    // Collect fee (once) from burner0 -> treasury
    if (!state.feeCollected && feeLamports > 0n) {
      const treasury = getTreasuryWallet();
      if (!treasury) throw new Error("UWU_TREASURY_WALLET is required when feeLamports > 0");

      await mutateUwuTransfer<UwuPrivyTransferData>({
        id,
        mutate: (r) => ({ status: r.status, data: { ...r.data, state: { ...r.data.state, inFlight: { action: "fee", startedAtUnixMs: Date.now() } } } }),
      });

      const burner0 = plan.burners[0];
      const fromPubkey = new PublicKey(burner0.address);

      const sent =
        plan.asset === "SOL"
          ? await transferLamportsFromPrivyWallet({
              connection,
              walletId: burner0.walletId,
              fromPubkey,
              to: treasury,
              lamports: Number(feeLamports),
            })
          : await transferSplTokensFromPrivyWallet({
              connection,
              mint: new PublicKey((plan.asset as any).mint),
              walletId: burner0.walletId,
              fromOwner: fromPubkey,
              toOwner: treasury,
              amountRaw: feeLamports,
            });

      await mutateUwuTransfer<UwuPrivyTransferData>({
        id,
        mutate: (r) => ({
          status: r.status,
          data: {
            ...r.data,
            state: {
              ...r.data.state,
              inFlight: undefined,
              feeCollected: true,
              feeSignature: sent.signature,
            },
          },
        }),
      });

      return NextResponse.json({ ok: true, id, status: "routing", action: "fee", signature: sent.signature });
    }

    // Execute next hop
    const hopCount = Number(plan.hopCount || 0);
    const hopIndex = Number(state.currentHop || 0);

    if (hopIndex >= hopCount) {
      await mutateUwuTransfer<UwuPrivyTransferData>({
        id,
        mutate: (r) => ({
          status: "complete",
          data: { ...r.data, state: { ...r.data.state, finalSignature: r.data.state.finalSignature, inFlight: undefined } },
        }),
      });
      return NextResponse.json({ ok: true, id, status: "complete" });
    }

    const fromBurner = plan.burners[hopIndex];
    const toPubkey = hopIndex === hopCount - 1 ? new PublicKey(plan.toWallet) : new PublicKey(plan.burners[hopIndex + 1].address);

    await mutateUwuTransfer<UwuPrivyTransferData>({
      id,
      mutate: (r) => ({ status: r.status, data: { ...r.data, state: { ...r.data.state, inFlight: { action: `hop:${hopIndex}`, startedAtUnixMs: Date.now() } } } }),
    });

    let signature = "";
    if (plan.asset === "SOL") {
      const sent = await transferLamportsFromPrivyWallet({
        connection,
        walletId: fromBurner.walletId,
        fromPubkey: new PublicKey(fromBurner.address),
        to: toPubkey,
        lamports: Number(netLamports),
      });
      signature = sent.signature;
    } else {
      const mint = new PublicKey((plan.asset as any).mint);
      const sent = await transferSplTokensFromPrivyWallet({
        connection,
        mint,
        walletId: fromBurner.walletId,
        fromOwner: new PublicKey(fromBurner.address),
        toOwner: toPubkey,
        amountRaw: netLamports,
      });
      signature = sent.signature;
    }

    const nextHop = hopIndex + 1;
    const isComplete = nextHop >= hopCount;
    const nextDelay = Number(plan.hopDelaysMs?.[nextHop] ?? 0);

    await mutateUwuTransfer<UwuPrivyTransferData>({
      id,
      mutate: (r) => {
        const existing = Array.isArray(r.data.state.hopResults) ? r.data.state.hopResults : [];
        existing.push({ index: hopIndex, signature, success: true });

        const nextState = {
          ...r.data.state,
          inFlight: undefined,
          hopResults: existing,
          currentHop: nextHop,
          nextActionAtUnixMs: Date.now() + nextDelay,
          ...(isComplete ? { finalSignature: signature } : {}),
        };

        return { status: isComplete ? "complete" : "routing", data: { ...r.data, state: nextState } };
      },
    });

    return NextResponse.json({ ok: true, id, status: isComplete ? "complete" : "routing", hopIndex, signature });
  } catch (e) {
    const msg = getSafeErrorMessage(e);

    if (id) {
      try {
        await mutateUwuTransfer<UwuPrivyTransferData>({
          id,
          mutate: (r) => ({
            status: "failed",
            data: { ...r.data, state: { ...r.data.state, inFlight: undefined, lastError: msg } },
          }),
        });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
