import { NextResponse } from "next/server";

import { getConnection, withRetry } from "../../../lib/rpc";

export const runtime = "nodejs";

export async function GET() {
  const connection = getConnection();
  const latest = await withRetry(() => connection.getLatestBlockhashAndContext("confirmed"));

  return NextResponse.json(
    {
      blockhash: latest.value.blockhash,
      lastValidBlockHeight: latest.value.lastValidBlockHeight,
      minContextSlot: latest.context.slot,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
