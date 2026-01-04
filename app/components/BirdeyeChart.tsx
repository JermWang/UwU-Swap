"use client";

import PriceChart from "./PriceChart";

type Props = {
  tokenMint: string;
  chain?: string;
  height?: number;
  theme?: "dark" | "light";
};

export default function BirdeyeChart({ tokenMint, chain = "solana", height = 400, theme = "dark" }: Props) {
  return <PriceChart tokenMint={tokenMint} chain="solana" height={height} theme={theme} />;
}
