import { NextRequest, NextResponse } from "next/server";
import bs58 from "bs58";
import { Transaction } from "@solana/web3.js";

import { confirmSignatureViaRpc, getConnection, getServerCommitment, withRetry } from "../../../lib/rpc";
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
    const minContextSlot =
      typeof body?.minContextSlot === "number" && Number.isFinite(body.minContextSlot)
        ? Math.floor(body.minContextSlot)
        : undefined;

    if (!raw) {
      return NextResponse.json({ error: "Missing txBase64" }, { status: 400 });
    }

    const bytes = Buffer.from(raw, "base64");
    const connection = getConnection();
    const finality = getServerCommitment();

    const isCommitmentSatisfied = (current: string | null | undefined, desired: typeof finality): boolean => {
      const c = String(current ?? "");
      if (desired === "processed") return c === "processed" || c === "confirmed" || c === "finalized";
      if (desired === "confirmed") return c === "confirmed" || c === "finalized";
      if (desired === "finalized") return c === "finalized";
      return c === desired;
    };

    const tryConfirmCandidateSigFast = async (sig: string): Promise<boolean> => {
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

    // Retry loop for blockhash issues (similar to CommitToShip's working implementation)
    const maxAttempts = 4;
    let signature = "";
    let candidateSig = "";

    // Try to extract the signature from the signed tx for fallback confirmation
    try {
      const parsed = Transaction.from(bytes);
      const sigBytes = parsed.signatures?.[0]?.signature;
      if (sigBytes) candidateSig = bs58.encode(Uint8Array.from(sigBytes));
    } catch {
      // ignore
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        signature = await withTimeout(
          connection.sendRawTransaction(bytes, {
            skipPreflight,
            preflightCommitment: "processed",
            maxRetries: 2,
            minContextSlot,
          }),
          10_000
        );
        break;
      } catch (e) {
        const msg = String((e as any)?.message ?? e ?? "");
        const lower = msg.toLowerCase();

        // Check if this is a retryable blockhash error
        const retryable =
          (lower.includes("blockhash") && (lower.includes("expired") || lower.includes("not found"))) ||
          lower.includes("block height exceeded") ||
          lower.includes("blockheight exceeded") ||
          lower.includes("timed out") ||
          lower.includes("timeout") ||
          lower.includes("node is behind") ||
          lower.includes("rpc timeout");

        // If we have a candidate signature, try to confirm it (tx may have landed)
        if (candidateSig) {
          try {
            const ok = await tryConfirmCandidateSigFast(candidateSig);
            if (ok) {
              return NextResponse.json(
                { signature: candidateSig, confirmed: true },
                { headers: { "Cache-Control": "no-store" } }
              );
            }
          } catch {
            // ignore - tx didn't land
          }
        }

        if (!retryable || attempt === maxAttempts - 1) {
          throw e;
        }

        // Wait before retry
        await new Promise((r) => setTimeout(r, 250 + attempt * 350));
      }
    }

    if (!signature) {
      // Common case: blockhash expired / not found -> client must re-sign with a fresh blockhash.
      return NextResponse.json(
        {
          error: "Blockhash not found. Please re-sign with a fresh blockhash.",
          code: "BLOCKHASH_NOT_FOUND",
        },
        { status: 409 }
      );
    }

    if (confirm) {
      await withTimeout(confirmSignatureViaRpc(connection, signature, finality), 20_000);
      return NextResponse.json({ signature, confirmed: true }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ signature, confirmed: false }, { headers: { "Cache-Control": "no-store" } });
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
