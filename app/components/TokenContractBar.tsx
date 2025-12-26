"use client";

import { useState } from "react";

function shorten(addr: string): string {
  const a = addr.trim();
  if (a.length <= 16) return a;
  return `${a.slice(0, 6)}…${a.slice(-6)}`;
}

export default function TokenContractBar() {
  const addr = (process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS ?? "").trim();

  const [copied, setCopied] = useState(false);

  const hasAddr = addr.length > 0;

  async function onCopy() {
    try {
      if (!hasAddr) return;
      if (!window.isSecureContext || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is not available in this context");
      }
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className={`globalNavTokenCopy${copied ? " globalNavTokenCopyCopied" : ""}`}
      onClick={onCopy}
      aria-label="Copy contract address"
      aria-disabled={!hasAddr}
    >
      <span className="globalNavTokenLabel">CA</span>
      <span className="globalNavTokenAddr">{hasAddr ? shorten(addr) : "Not set"}</span>
      <span className="globalNavTokenHint">{hasAddr ? (copied ? "Copied" : "Copy") : "Set"}</span>
    </button>
  );
}
