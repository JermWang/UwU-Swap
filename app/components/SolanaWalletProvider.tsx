"use client";

import { ReactNode, useCallback, useEffect, useMemo } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletAdapterNetwork, WalletError } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";

export default function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const network = useMemo<WalletAdapterNetwork>(() => {
    const raw = String(process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "mainnet-beta").trim();
    if (raw === "devnet") return WalletAdapterNetwork.Devnet;
    if (raw === "testnet") return WalletAdapterNetwork.Testnet;
    return WalletAdapterNetwork.Mainnet;
  }, []);

  const endpoint = useMemo(() => {
    const explicit = String(process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "").trim();
    if (explicit.length) return explicit;

    const cluster = String(process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "mainnet-beta").trim();
    if (cluster === "devnet" || cluster === "testnet" || cluster === "mainnet-beta") {
      return clusterApiUrl(cluster);
    }

    return clusterApiUrl("mainnet-beta");
  }, []);

  const wallets = useMemo(() => {
    return [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network }), new BackpackWalletAdapter()];
  }, [network]);

  const onError = useCallback((error: WalletError) => {
    const anyErr: any = error as any;
    const details = {
      name: String((error as any)?.name ?? ""),
      message: String((error as any)?.message ?? ""),
      causeName: String(anyErr?.cause?.name ?? ""),
      causeMessage: String(anyErr?.cause?.message ?? ""),
      innerName: String(anyErr?.error?.name ?? ""),
      innerMessage: String(anyErr?.error?.message ?? ""),
      code: anyErr?.code,
    };
    console.error("[wallet] error", details, { cause: anyErr?.cause, inner: anyErr?.error }, error);
  }, []);

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    for (const w of wallets) {
      const anyWallet: any = w as any;

      const onAdapterError = (e: any) => {
        console.error("[wallet] adapter error", { adapter: String(anyWallet?.name ?? ""), error: e });
      };

      const onReady = () => {
        console.log("[wallet] adapter readyStateChange", {
          adapter: String(anyWallet?.name ?? ""),
          readyState: String(anyWallet?.readyState ?? ""),
        });
      };

      if (typeof anyWallet?.on === "function") {
        try {
          anyWallet.on("error", onAdapterError);
          anyWallet.on("readyStateChange", onReady);
          unsubs.push(() => {
            try {
              anyWallet.off?.("error", onAdapterError);
              anyWallet.off?.("readyStateChange", onReady);
            } catch {
              // ignore
            }
          });
        } catch {
          // ignore
        }
      }
    }

    return () => {
      for (const u of unsubs) u();
    };
  }, [wallets]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} onError={onError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
