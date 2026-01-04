"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  tokenMint: string;
  chain?: "solana";
  height?: number;
  theme?: "dark" | "light";
};

type DexScreenerPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  liquidity?: { usd?: number };
};

function pickBestPair(pairs: DexScreenerPair[], chain: string): DexScreenerPair | null {
  const filtered = pairs.filter((p) => String(p?.chainId ?? "").toLowerCase() === chain.toLowerCase());
  if (!filtered.length) return null;

  let best: DexScreenerPair | null = null;
  let bestUsd = -1;
  for (const p of filtered) {
    const usd = Number(p?.liquidity?.usd ?? 0);
    if (Number.isFinite(usd) && usd > bestUsd) {
      bestUsd = usd;
      best = p;
    }
  }
  return best ?? filtered[0] ?? null;
}

export default function PriceChart({ tokenMint, chain = "solana", height = 400, theme = "dark" }: Props) {
  const [pair, setPair] = useState<DexScreenerPair | null>(null);
  const [pairLoading, setPairLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!tokenMint) return;
      setPairLoading(true);
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(tokenMint)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`DexScreener request failed (${res.status})`);
        const json = (await res.json().catch(() => null)) as any;
        const pairs = Array.isArray(json?.pairs) ? (json.pairs as DexScreenerPair[]) : [];
        const best = pickBestPair(pairs, chain);
        if (cancelled) return;
        setPair(best);
      } catch {
        if (cancelled) return;
        setPair(null);
      } finally {
        if (cancelled) return;
        setPairLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tokenMint, chain]);

  const viewDexUrl = useMemo(() => {
    const pairAddress = String((pair as any)?.pairAddress ?? "").trim();
    const id = pairAddress || tokenMint;
    return `https://dexscreener.com/${encodeURIComponent(chain)}/${encodeURIComponent(id)}`;
  }, [pair, tokenMint, chain]);

  if (!tokenMint) return null;

  return (
    <div className="birdeyeChartWrap">
      <div className="birdeyeChartLoading" style={{ position: "relative" }}>
        <div className="birdeyeChartSpinner" style={{ opacity: pairLoading ? 1 : 0 }} />
        <span style={{ textAlign: "center", maxWidth: 520 }}>
          {pairLoading ? "Finding market…" : "Open the live chart on DexScreener."}
        </span>
        <a href={viewDexUrl} target="_blank" rel="noopener noreferrer" className="birdeyeChartLink">
          View on DexScreener →
        </a>
      </div>
    </div>
  );
}
