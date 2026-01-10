import { NextRequest, NextResponse } from "next/server";
import bs58 from "bs58";
import { Connection, Transaction } from "@solana/web3.js";

import { getConnectionForRpcUrl, getRpcUrls, getServerCommitment, withRetry } from "../../../lib/rpc";
import { getSafeErrorMessage } from "../../../lib/safeError";

export const runtime = "nodejs";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("RPC timeout")), ms);
  });
  return Promise.race([
    p.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    timeout,
  ]);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const raw = String(body?.txBase64 ?? "").trim();
    const confirm = body?.confirm === true;
    const skipPreflight = body?.skipPreflight !== false;
    const preferredRpcUrl = typeof body?.rpcUrl === "string" && body.rpcUrl.trim() ? body.rpcUrl.trim() : undefined;
    const minContextSlot =
      typeof body?.minContextSlot === "number" && Number.isFinite(body.minContextSlot)
        ? Math.floor(body.minContextSlot)
        : undefined;

    if (!raw) {
      return NextResponse.json({ error: "Missing txBase64" }, { status: 400 });
    }

    const bytes = Buffer.from(raw, "base64");
    const finality = getServerCommitment();

    const isCommitmentSatisfied = (current: string | null | undefined, desired: typeof finality): boolean => {
      const c = String(current ?? "");
      if (desired === "processed") return c === "processed" || c === "confirmed" || c === "finalized";
      if (desired === "confirmed") return c === "confirmed" || c === "finalized";
      if (desired === "finalized") return c === "finalized";
      return c === desired;
    };

    const tryConfirmCandidateSigFast = async (connection: Connection, sig: string): Promise<boolean> => {
      const deadline = Date.now() + 4_000;
      while (Date.now() < deadline) {
        const st = await withRetry(() => connection.getSignatureStatuses([sig], { searchTransactionHistory: true }), {
          attempts: 2,
          baseDelayMs: 150,
        });
        const s: any = st?.value?.[0];
        if (s?.err) return false;
        const confirmationStatus = typeof s?.confirmationStatus === "string" ? s.confirmationStatus : null;
        if (confirmationStatus && isCommitmentSatisfied(confirmationStatus, finality)) return true;
        await new Promise((r) => setTimeout(r, 350));
      }
      return false;
    };

    const baseUrls = getRpcUrls();
    const urls = preferredRpcUrl
      ? [preferredRpcUrl, ...baseUrls.filter((u) => u !== preferredRpcUrl)]
      : baseUrls;
    const maxAttempts = 2;
    let candidateSig = "";

    // Try to extract the signature from the signed tx for fallback confirmation
    try {
      const parsed = Transaction.from(bytes);
      const sigBytes = parsed.signatures?.[0]?.signature;
      if (sigBytes) candidateSig = bs58.encode(Uint8Array.from(sigBytes));
    } catch {
      // ignore
    }

    let lastErr: unknown;

    for (let urlIndex = 0; urlIndex < urls.length; urlIndex++) {
      const url = urls[urlIndex];
      const connection = getConnectionForRpcUrl(url);
      let currentMinContextSlot = minContextSlot;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const signature = await withTimeout(
            connection.sendRawTransaction(bytes, {
              skipPreflight,
              preflightCommitment: "processed",
              maxRetries: 2,
              minContextSlot: currentMinContextSlot,
            }),
            10_000
          );

          if (confirm) {
            try {
              const ok = await withTimeout(tryConfirmCandidateSigFast(connection, signature), 6_000);
              if (ok) {
                return NextResponse.json({ signature, confirmed: true }, { headers: { "Cache-Control": "no-store" } });
              }
            } catch {
              // Best-effort only; we'll return the signature and let the client/server polling confirm later.
            }
            return NextResponse.json({ signature, confirmed: false }, { headers: { "Cache-Control": "no-store" } });
          }

          return NextResponse.json({ signature, confirmed: false }, { headers: { "Cache-Control": "no-store" } });
        } catch (e) {
          lastErr = e;
          const msg = String((e as any)?.message ?? e ?? "");
          const lower = msg.toLowerCase();

          const retryable =
            (lower.includes("blockhash") && (lower.includes("expired") || lower.includes("not found"))) ||
            lower.includes("block height exceeded") ||
            lower.includes("blockheight exceeded") ||
            lower.includes("timed out") ||
            lower.includes("timeout") ||
            lower.includes("node is behind") ||
            lower.includes("rpc timeout");

          const minContextSlotRelated =
            lower.includes("mincontextslot") || lower.includes("min context slot") || lower.includes("node is behind");
          if (urlIndex > 0 && currentMinContextSlot !== undefined && minContextSlotRelated) {
            currentMinContextSlot = undefined;
          }

          if (candidateSig) {
            try {
              const ok = await tryConfirmCandidateSigFast(connection, candidateSig);
              if (ok) {
                return NextResponse.json(
                  { signature: candidateSig, confirmed: true },
                  { headers: { "Cache-Control": "no-store" } }
                );
              }
            } catch {
              // ignore
            }
          }

          if (!retryable) {
            break;
          }

          await new Promise((r) => setTimeout(r, 250 + attempt * 350));
        }
      }
    }

    const lastMsg = lastErr instanceof Error ? lastErr.message : String(lastErr ?? "");
    if (lastMsg.toLowerCase().includes("blockhash") && lastMsg.toLowerCase().includes("not found")) {
      return NextResponse.json(
        {
          error: "Blockhash not found. Please re-sign with a fresh blockhash.",
          code: "BLOCKHASH_NOT_FOUND",
        },
        { status: 409 }
      );
    }

    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));

  } catch (e) {
    const msg = getSafeErrorMessage(e);
    if (msg.toLowerCase().includes("blockhash not found")) {
      return NextResponse.json(
        {
          error: msg,
          code: "BLOCKHASH_NOT_FOUND",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
