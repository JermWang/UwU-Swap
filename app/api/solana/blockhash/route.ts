import { NextResponse } from "next/server";

import { getConnection, withRetry } from "../../../lib/rpc";

export const runtime = "nodejs";

export async function GET() {
  const connection = getConnection();
  const latest = await withRetry(() => connection.getLatestBlockhash("processed"));

  return NextResponse.json(
    {
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
