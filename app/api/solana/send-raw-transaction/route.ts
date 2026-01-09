import { NextRequest, NextResponse } from "next/server";
import bs58 from "bs58";
import { Transaction } from "@solana/web3.js";

import { confirmSignatureViaRpc, getConnection, getServerCommitment, withRetry } from "../../../lib/rpc";
import { getSafeErrorMessage } from "../../../lib/safeError";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const raw = String(body?.txBase64 ?? "").trim();
    const confirm = body?.confirm === true;
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
        signature = await withRetry(() =>
          connection.sendRawTransaction(bytes, {
            skipPreflight: false,
            preflightCommitment: "processed",
            maxRetries: 3,
            minContextSlot,
          })
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
          lower.includes("node is behind");

        // If we have a candidate signature, try to confirm it (tx may have landed)
        if (candidateSig) {
          try {
            await confirmSignatureViaRpc(connection, candidateSig, finality);
            return NextResponse.json({ signature: candidateSig }, { headers: { "Cache-Control": "no-store" } });
          } catch {
            // ignore - tx didn't land
          }
        }

        if (!retryable || attempt === maxAttempts - 1) {
          throw e;
        }

        // Wait before retry
        await new Promise((r) => setTimeout(r, 350 + attempt * 500));
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

    // Important: by default we return immediately after broadcast so the client UI can
    // start polling/routing indicators without waiting on RPC confirmation.
    if (confirm) {
      await confirmSignatureViaRpc(connection, signature, finality);
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
