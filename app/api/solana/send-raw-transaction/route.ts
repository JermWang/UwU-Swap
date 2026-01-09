import { NextRequest, NextResponse } from "next/server";

import { confirmSignatureViaRpc, getConnection, getServerCommitment, withRetry } from "../../../lib/rpc";
import { getSafeErrorMessage } from "../../../lib/safeError";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const raw = String(body?.txBase64 ?? "").trim();

    if (!raw) {
      return NextResponse.json({ error: "Missing txBase64" }, { status: 400 });
    }

    const bytes = Buffer.from(raw, "base64");
    const connection = getConnection();

    const signature = await withRetry(() =>
      connection.sendRawTransaction(bytes, {
        skipPreflight: false,
        preflightCommitment: "processed",
      })
    );

    await confirmSignatureViaRpc(connection, signature, getServerCommitment());

    return NextResponse.json({ signature }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}
