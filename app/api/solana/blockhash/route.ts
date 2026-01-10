import { NextResponse } from "next/server";

import { getConnectionForRpcUrl, getRpcUrls, withRetry } from "../../../lib/rpc";

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

export async function GET() {
  const urls = getRpcUrls();
  let lastErr: unknown;

  for (const url of urls) {
    try {
      const connection = getConnectionForRpcUrl(url);
      const latest = await withTimeout(withRetry(() => connection.getLatestBlockhashAndContext("confirmed")), 8_000);
      return NextResponse.json(
        {
          blockhash: latest.value.blockhash,
          lastValidBlockHeight: latest.value.lastValidBlockHeight,
          minContextSlot: latest.context.slot,
          rpcUrl: url,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (e) {
      lastErr = e;
      continue;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
