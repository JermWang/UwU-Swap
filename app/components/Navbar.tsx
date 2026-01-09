"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

const CONTRACT_ADDRESS: string = String(process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS ?? "").trim();

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

export default function Navbar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (path: string) => pathname === path;

  const handleCopyContract = useCallback(async () => {
    if (!CONTRACT_ADDRESS) {
      return;
    }
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Left Section - Logo + Contract */}
        <div className="navbar-left">
          <Link href="/" className="navbar-brand">
            <img 
              src="/branding/AI_assistant_avatar.png" 
              alt="Uwu Swap" 
              className="navbar-logo-img"
            />
          </Link>

          {/* Contract Address Button */}
          <button 
            className="navbar-contract-btn"
            onClick={handleCopyContract}
            disabled={!CONTRACT_ADDRESS}
            title={CONTRACT_ADDRESS || "Contract address coming soon"}
          >
            <span className="navbar-contract-label">$UWU</span>
            <span className="navbar-contract-address">
              {CONTRACT_ADDRESS ? `${CONTRACT_ADDRESS.slice(0, 4)}...${CONTRACT_ADDRESS.slice(-4)}` : "Coming Soon"}
            </span>
            {CONTRACT_ADDRESS && (
              <span className="navbar-contract-copy">
                {copied ? <CheckIcon /> : <CopyIcon />}
              </span>
            )}
          </button>
        </div>

        {/* Center Section - Navigation Links */}
        <div className="navbar-center">
          <div className="navbar-links">
          <Link 
            href="/" 
            className={`navbar-link ${isActive("/") ? "navbar-link--active" : ""}`}
          >
            <SwapIcon />
            <span>Swap</span>
          </Link>
          <Link 
            href="/docs" 
            className={`navbar-link ${isActive("/docs") ? "navbar-link--active" : ""}`}
          >
            <DocsIcon />
            <span>Docs</span>
          </Link>
          <a 
            href="https://twitter.com/uwuswap" 
            target="_blank" 
            rel="noopener noreferrer"
            className="navbar-link"
          >
            <XIcon />
            <span className="sr-only">Twitter</span>
          </a>
          </div>
        </div>

        {/* Right Section - Wallet Button */}
        <div className="navbar-right">
          {mounted && <WalletMultiButton />}
        </div>
      </div>
    </nav>
  );
}

function SwapIcon() {
  return (
    <svg 
      width="20" 
      height="20" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M16 3l4 4-4 4" />
      <path d="M20 7H4" />
      <path d="M8 21l-4-4 4-4" />
      <path d="M4 17h16" />
    </svg>
  );
}

function DocsIcon() {
  return (
    <svg 
      width="20" 
      height="20" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg 
      width="20" 
      height="20" 
      viewBox="0 0 24 24" 
      fill="currentColor"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg 
      width="14" 
      height="14" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg 
      width="14" 
      height="14" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
