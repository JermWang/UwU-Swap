"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction } from "@solana/web3.js";

import {
  parseUserMessage,
  generateHelpResponse,
  generateTransferConfirmation,
  generateRoutingUpdate,
  generateBalanceResponse,
  generateUnknownResponse,
  solToLamports,
  lamportsToSol,
  ChatMessage,
  ParsedTransferCommand,
} from "./lib/uwuChat";
import TransferModal, { TransferModalData } from "./components/TransferModal";

function bytesToBase64(bytes: ArrayLike<number> | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes as any);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < u8.length; i += chunkSize) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunkSize));
  }
  return window.btoa(binary);
}

type TransferState = {
  planId: string;
  status: "pending" | "signing" | "awaiting_funding" | "routing" | "complete" | "failed";
  hopCount: number;
  currentHop: number;
  firstBurnerPubkey: string;
  amountLamports: string;
};

type QuickSendState = {
  status: "awaiting_deposit" | "routing" | "complete" | "failed";
  planId: string;
  depositAddress: string;
  destinationAddress: string;
  amount: number;
  netAmount?: number;
  feeApplied?: boolean;
  feeSol?: number;
  hopCount: number;
  currentHop: number;
  startTime: number;
  estimatedCompletionMs?: number;
  routingStartedAtUnixMs?: number;
  estimatedArrival?: number;
  fundingExpiresAtUnixMs?: number;
  requiredLamports?: string;
  depositBalanceLamports?: string;
  lastError?: string;
  txSignature?: string;
};

type AgentProfile = {
  name?: string;
  role?: string;
  personality?: {
    tone?: string;
    vibe?: string;
    speech_style?: string;
    mannerisms?: string[];
  };
  knowledge_scope?: string[];
  sample_phrases?: {
    greeting?: string;
    explaining_privacy?: string;
    fee_logic?: string;
    error_wallet?: string;
    swap_start?: string;
  };
  visual_cue?: {
    avatar_description?: string;
    dominant_colors?: string[];
  };
  custom_tags?: string[];
};

export default function Home() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `# Welcome to Uwu Swap ~

Privacy-first token transfers on Solana, nya~

**Quick Start:**
- "send 2 SOL privately to [address]"
- "balance" - check your wallet
- "help" - view all commands

Hold $UWU tokens for zero-fee transfers!`,
      timestamp: 0, // Use 0 for initial message to avoid hydration mismatch
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [transferState, setTransferState] = useState<TransferState | null>(null);
  const [balanceInfo, setBalanceInfo] = useState<{ sol: number; hasShip: boolean } | null>(null);
  const [swapMode, setSwapMode] = useState<"custodial" | "non-custodial">("non-custodial");
  const [quickSendState, setQuickSendState] = useState<QuickSendState | null>(null);
  const [quickSendForm, setQuickSendForm] = useState({ destination: "", amount: "" });
  const [isQuickSendLoading, setIsQuickSendLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [transferModalData, setTransferModalData] = useState<TransferModalData | null>(null);
  const [isModalSigning, setIsModalSigning] = useState(false);

  const effectiveSwapMode: "custodial" | "non-custodial" = swapMode;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const transferPollIntervalRef = useRef<number | null>(null);
  const lastSeenHopResultsRef = useRef<Set<string>>(new Set());

  const quickSendPollIntervalRef = useRef<number | null>(null);

  const prevMessagesLength = useRef(1); // Start at 1 for welcome message
  const lastFundingDiagRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    // Only scroll within the messages container, not the page
    if (messagesEndRef.current?.parentElement) {
      messagesEndRef.current.parentElement.scrollTop = messagesEndRef.current.parentElement.scrollHeight;
    }
  }, []);

  useEffect(() => {
    // Only scroll when new messages are added, not on initial load
    if (messages.length > prevMessagesLength.current) {
      scrollToBottom();
    }
    prevMessagesLength.current = messages.length;
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchBalance(publicKey.toBase58());
    }
  }, [connected, publicKey]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/agent-profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((profile: AgentProfile | null) => {
        if (cancelled || !profile) return;

        const greeting = profile.sample_phrases?.greeting?.trim();
        if (!greeting) return;

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== "welcome") return m;
            return {
              ...m,
              content: `${greeting}\n\n${m.content}`,
            };
          })
        );
      })
      .catch(() => {
        // ignore
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Timer for elapsed time during transfer
  useEffect(() => {
    if (quickSendState && quickSendState.status !== "complete" && quickSendState.status !== "failed") {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - quickSendState.startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [quickSendState]);

  const stopQuickSendPolling = useCallback(() => {
    if (quickSendPollIntervalRef.current != null) {
      window.clearInterval(quickSendPollIntervalRef.current);
      quickSendPollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopQuickSendPolling();
  }, [stopQuickSendPolling]);

  const resetQuickSend = useCallback(() => {
    stopQuickSendPolling();
    setQuickSendState(null);
    setQuickSendForm({ destination: "", amount: "" });
    setElapsedTime(0);
  }, [stopQuickSendPolling]);

  const copyToClipboard = useCallback(async (text: string) => {
    const t = String(text ?? "");
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      // ignore
    }
  }, []);

  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getEstimatedRemaining = () => {
    if (!quickSendState) return "—";

    const estMs = Number(quickSendState.estimatedCompletionMs ?? 0);
    const hasEstimate = Number.isFinite(estMs) && estMs > 0;

    if (quickSendState.status === "awaiting_deposit") {
      if (!hasEstimate) return "After deposit";
      return `~${Math.ceil(estMs / 1000)}s after deposit`;
    }

    if (quickSendState.status !== "routing") return "—";

    const routingStartedAt = Number(quickSendState.routingStartedAtUnixMs ?? 0);
    if (!Number.isFinite(routingStartedAt) || routingStartedAt <= 0 || !hasEstimate) return "—";

    const eta = routingStartedAt + estMs;
    const remaining = Math.max(0, Math.floor((eta - Date.now()) / 1000));
    if (remaining <= 0) return "Any moment...";
    return `~${remaining}s`;
  };

  const formatExpiresIn = (expiresAtUnixMs?: number) => {
    if (!expiresAtUnixMs || !Number.isFinite(expiresAtUnixMs)) return "—";
    const ms = Math.max(0, expiresAtUnixMs - Date.now());
    const sec = Math.floor(ms / 1000);
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startQuickSendPolling = useCallback(
    (input: { planId: string }) => {
      stopQuickSendPolling();

      const pollOnce = async () => {
        const stepRes = await fetch("/api/transfer/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: input.planId }),
          cache: "no-store",
        });
        const stepData = await stepRes.json().catch(() => null);

        const statusRes = await fetch(`/api/transfer/status?id=${encodeURIComponent(input.planId)}`, { cache: "no-store" });
        const statusData = await statusRes.json().catch(() => null);

        const serverStatus = String(statusData?.status ?? stepData?.status ?? "");

        if (statusData?.error || stepData?.error) {
          const errMsg = String(statusData?.error ?? stepData?.error ?? "Transfer failed");
          setQuickSendState((prev) =>
            prev
              ? {
                  ...prev,
                  status: "failed",
                  lastError: errMsg,
                }
              : null
          );
          stopQuickSendPolling();
          return;
        }

        const hopCount = Number(statusData?.plan?.hopCount ?? 0);
        const currentHop = Number(statusData?.state?.currentHop ?? 0);
        const finalSig = typeof statusData?.state?.finalSignature === "string" ? statusData.state.finalSignature : "";

        const estimatedMs = Number(statusData?.plan?.estimatedCompletionMs ?? 0);

        const expiresAt = Number(statusData?.plan?.fundingExpiresAtUnixMs ?? 0);

        const funded = Boolean(stepData?.funded ?? false);
        const awaitingFunding = serverStatus === "awaiting_funding" && !funded;

        const nextStatus: QuickSendState["status"] =
          serverStatus === "complete" ? "complete" : serverStatus === "failed" ? "failed" : serverStatus === "routing" ? "routing" : "awaiting_deposit";

        setQuickSendState((prev) => {
          if (!prev) return prev;

          const nextEstimatedMs =
            Number.isFinite(estimatedMs) && estimatedMs > 0 ? estimatedMs : Number(prev.estimatedCompletionMs ?? 0);

          const shouldStartRoutingClock = nextStatus === "routing" && !prev.routingStartedAtUnixMs;
          const routingStartedAtUnixMs = shouldStartRoutingClock
            ? Date.now()
            : prev.routingStartedAtUnixMs;

          const nextEstimatedArrival =
            nextStatus === "routing" && routingStartedAtUnixMs && nextEstimatedMs > 0
              ? routingStartedAtUnixMs + nextEstimatedMs
              : prev.estimatedArrival;

          const next: QuickSendState = {
            ...prev,
            status: nextStatus,
            hopCount: hopCount || prev.hopCount,
            currentHop,
            estimatedCompletionMs: nextEstimatedMs > 0 ? nextEstimatedMs : prev.estimatedCompletionMs,
            routingStartedAtUnixMs,
            estimatedArrival: nextEstimatedArrival,
            fundingExpiresAtUnixMs: expiresAt || prev.fundingExpiresAtUnixMs,
            txSignature: finalSig || prev.txSignature,
          };

          if (awaitingFunding) {
            if (stepData?.requiredLamports != null) next.requiredLamports = String(stepData.requiredLamports);
            if (stepData?.balanceLamports != null) next.depositBalanceLamports = String(stepData.balanceLamports);
          }

          if (nextStatus === "failed") {
            next.lastError = String(statusData?.state?.lastError ?? prev.lastError ?? "Transfer failed");
          }

          return next;
        });

        if (serverStatus === "complete" || serverStatus === "failed") {
          stopQuickSendPolling();
        }
      };

      pollOnce().catch(() => null);
      quickSendPollIntervalRef.current = window.setInterval(() => {
        pollOnce().catch(() => null);
      }, 2200);
    },
    [stopQuickSendPolling]
  );

  const handleGenerateDepositAddress = useCallback(async () => {
    const destination = String(quickSendForm.destination ?? "").trim();
    const amount = Number(quickSendForm.amount);
    if (!destination || !Number.isFinite(amount) || amount <= 0) return;

    setIsQuickSendLoading(true);
    stopQuickSendPolling();

    try {
      const planRes = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toWallet: destination,
          amountSol: amount,
          asset: null,
          mode: "non_custodial",
        }),
        cache: "no-store",
      });

      const planData = await planRes.json().catch(() => null);
      if (!planRes.ok || !planData || typeof planData !== "object" || planData?.error) {
        const msg = String(planData?.error ?? "Failed to create deposit address");
        setQuickSendState({
          status: "failed",
          planId: "",
          depositAddress: "",
          destinationAddress: destination,
          amount,
          hopCount: 0,
          currentHop: 0,
          startTime: Date.now(),
          estimatedArrival: Date.now(),
          lastError: msg,
        });
        return;
      }

      const planId = String(planData.id ?? "");
      const depositAddress = String(planData.firstBurnerPubkey ?? "");
      const hopCount = Number(planData.hopCount ?? 0);
      const estMs = Number(planData.estimatedCompletionMs ?? 0);
      const expiresAt = Number(planData.fundingExpiresAtUnixMs ?? 0);
      const feeSol = lamportsToSol(BigInt(String(planData.feeLamports ?? "0")));
      const feeApplied = Boolean(planData.feeApplied);
      const netAmount = Math.max(0, amount - (feeApplied ? feeSol : 0));

      setQuickSendState({
        status: "awaiting_deposit",
        planId,
        depositAddress,
        destinationAddress: String(planData.resolvedToWallet ?? destination),
        amount,
        netAmount,
        feeApplied,
        feeSol,
        hopCount,
        currentHop: 0,
        startTime: Date.now(),
        estimatedCompletionMs: Number.isFinite(estMs) && estMs > 0 ? estMs : undefined,
        estimatedArrival: undefined,
        fundingExpiresAtUnixMs: Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : undefined,
      });

      setElapsedTime(0);
      startQuickSendPolling({ planId });
    } finally {
      setIsQuickSendLoading(false);
    }
  }, [quickSendForm.amount, quickSendForm.destination, startQuickSendPolling, stopQuickSendPolling]);

  const fetchBalance = async (wallet: string) => {
    try {
      const res = await fetch(`/api/balance?wallet=${wallet}`);
      const data = await res.json();
      if (data.balanceSol !== undefined) {
        setBalanceInfo({ sol: data.balanceSol, hasShip: data.hasUwuToken });
      }
    } catch (e) {
      console.error("Failed to fetch balance:", e);
    }
  };

  const addMessage = (role: "user" | "assistant" | "system", content: string, metadata?: ChatMessage["metadata"]) => {
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  };

  const callAssistantChat = useCallback(async (input: { userText: string; history: ChatMessage[] }) => {
    const history = input.history.slice(-18).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [...history, { role: "user", content: input.userText }] }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object") {
      return { reply: "Sorry—something went wrong.", action: null as any };
    }

    return data as { reply: string; action: any };
  }, []);

  const stopTransferPolling = useCallback(() => {
    if (transferPollIntervalRef.current != null) {
      window.clearInterval(transferPollIntervalRef.current);
      transferPollIntervalRef.current = null;
    }
  }, []);

  const startTransferPolling = useCallback(
    (input: { planId: string; fundingSignature?: string }) => {
      stopTransferPolling();
      lastSeenHopResultsRef.current = new Set();

      const pollOnce = async () => {
        const stepRes = await fetch("/api/transfer/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: input.planId, fundingSignature: input.fundingSignature }),
          cache: "no-store",
        });
        const stepData = await stepRes.json().catch(() => null);

        if (stepData && typeof stepData === "object") {
          const stepStatus = String((stepData as any)?.status ?? "");
          const funded = Boolean((stepData as any)?.funded ?? false);
          if (stepStatus === "awaiting_funding" && !funded) {
            const sig = typeof (stepData as any)?.fundingSignature === "string" ? (stepData as any).fundingSignature : "";
            const sigStatus = (stepData as any)?.signatureStatus;

            const balLamportsRaw = (stepData as any)?.balanceLamports;
            const balCommitment = typeof (stepData as any)?.balanceCommitment === "string" ? (stepData as any).balanceCommitment : "";
            const requiredRaw = (stepData as any)?.requiredLamports;

            const diagParts: string[] = [];
            if (sig) {
              const conf = typeof sigStatus?.confirmationStatus === "string" ? sigStatus.confirmationStatus : "unknown";
              const err = sigStatus?.err ? JSON.stringify(sigStatus.err) : "";
              diagParts.push(`Funding TX: \`${sig.slice(0, 10)}...\` (status: ${conf}${err ? `, err: ${err}` : ""})`);
            }

            if (balLamportsRaw != null && requiredRaw != null) {
              diagParts.push(`Deposit balance: ${String(balLamportsRaw)} / ${String(requiredRaw)} lamports (${balCommitment || ""})`);
            }

            const diag = diagParts.join("\n").trim();
            if (diag && lastFundingDiagRef.current !== diag) {
              lastFundingDiagRef.current = diag;
              addMessage("system", diag);
            }
          }
        }

        const statusRes = await fetch(`/api/transfer/status?id=${encodeURIComponent(input.planId)}`, { cache: "no-store" });
        const statusData = await statusRes.json();

        if (statusData?.error) {
          stopTransferPolling();
          addMessage(
            "assistant",
            generateRoutingUpdate({ currentHop: 0, totalHops: 0, status: "failed", error: String(statusData.error) })
          );
          setTransferState((prev) => (prev ? { ...prev, status: "failed" } : null));
          return;
        }

        const hopCount = Number(statusData?.plan?.hopCount ?? 0);
        const currentHop = Number(statusData?.state?.currentHop ?? 0);
        const serverStatus = String(statusData?.status ?? "");

        setTransferState((prev) =>
          prev
            ? {
                ...prev,
                hopCount: hopCount || prev.hopCount,
                currentHop,
                status:
                  serverStatus === "awaiting_funding"
                    ? "awaiting_funding"
                    : serverStatus === "routing"
                      ? "routing"
                      : serverStatus === "complete"
                        ? "complete"
                        : serverStatus === "failed"
                          ? "failed"
                          : prev.status,
              }
            : null
        );

        const hopResults = Array.isArray(statusData?.state?.hopResults) ? statusData.state.hopResults : [];
        for (const hr of hopResults) {
          const key = `${hr.index}:${hr.signature}`;
          if (lastSeenHopResultsRef.current.has(key)) continue;
          lastSeenHopResultsRef.current.add(key);
          if (hr?.success) {
            addMessage(
              "system",
              generateRoutingUpdate({
                currentHop: Number(hr.index) + 1,
                totalHops: hopCount,
                status: "routing",
              })
            );
          }
        }

        if (serverStatus === "complete") {
          stopTransferPolling();
          addMessage(
            "assistant",
            generateRoutingUpdate({
              currentHop: hopCount,
              totalHops: hopCount,
              status: "complete",
              signature: statusData?.state?.finalSignature || undefined,
            }),
            { transferId: input.planId, status: "complete" }
          );
          setTransferState((prev) => (prev ? { ...prev, status: "complete" } : null));
          if (publicKey) fetchBalance(publicKey.toBase58());
          return;
        }

        if (serverStatus === "failed") {
          stopTransferPolling();
          addMessage(
            "assistant",
            generateRoutingUpdate({
              currentHop,
              totalHops: hopCount,
              status: "failed",
              error: String(statusData?.state?.lastError ?? "Transfer failed"),
            }),
            { transferId: input.planId, status: "failed" }
          );
          setTransferState((prev) => (prev ? { ...prev, status: "failed" } : null));
        }
      };

      pollOnce().catch(() => null);
      transferPollIntervalRef.current = window.setInterval(() => {
        pollOnce().catch(() => null);
      }, 2200);
    },
    [addMessage, fetchBalance, publicKey, stopTransferPolling]
  );

  useEffect(() => {
    return () => stopTransferPolling();
  }, [stopTransferPolling]);

  const handleTransferCommand = async (cmd: ParsedTransferCommand) => {
    if (!publicKey || !signTransaction) {
      addMessage("assistant", "Please connect your wallet first! Click the connect button above~ 🔗");
      return;
    }

    setIsProcessing(true);

    try {
      const originalDestination = cmd.destination;

      // Create routing plan
      const planRes = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWallet: publicKey.toBase58(),
          toWallet: originalDestination,
          amountSol: cmd.amount,
          asset: cmd.asset === "SOL" ? null : cmd.asset,
        }),
      });

      const planData = await planRes.json();

      if (planData.error) {
        addMessage("assistant", `❌ Failed to create transfer plan: ${planData.error}`);
        setIsProcessing(false);
        return;
      }

      const feeSol = lamportsToSol(BigInt(planData.feeLamports || "0"));

      // Show confirmation modal instead of auto-signing
      setTransferModalData({
        amount: cmd.amount,
        destination: originalDestination,
        resolvedAddress: String(planData.resolvedToWallet ?? originalDestination),
        hopCount: planData.hopCount,
        estimatedTimeMs: planData.estimatedCompletionMs,
        feeApplied: planData.feeApplied,
        feeSol,
        planId: planData.id,
        firstBurnerPubkey: planData.firstBurnerPubkey,
      });

      // Also add a chat message
      addMessage(
        "assistant",
        `I've prepared your transfer! Please review the details and confirm~ ✧`,
        { transferId: planData.id, status: "pending" }
      );

    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      addMessage("assistant", `❌ Error: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleModalConfirm = async (editedAmount: number, editedDestination: string) => {
    if (!transferModalData || !publicKey || !signTransaction) return;

    setIsModalSigning(true);

    try {
      // Check if user made changes - if so, create a new routing plan
      const amountChanged = editedAmount !== transferModalData.amount;
      const destChanged = editedDestination !== transferModalData.destination;
      
      let planData = {
        id: transferModalData.planId,
        firstBurnerPubkey: transferModalData.firstBurnerPubkey,
        hopCount: transferModalData.hopCount,
        amount: transferModalData.amount,
      };

      if (amountChanged || destChanged) {
        addMessage("assistant", "Creating new routing plan with your changes...");

        // Create new routing plan
        const planRes = await fetch("/api/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromWallet: publicKey.toBase58(),
            toWallet: editedDestination,
            amountSol: editedAmount,
            asset: null,
          }),
        });

        const newPlanData = await planRes.json();
        if (newPlanData.error) {
          addMessage("assistant", `❌ Failed to create transfer plan: ${newPlanData.error}`);
          setIsModalSigning(false);
          return;
        }

        planData = {
          id: newPlanData.id,
          firstBurnerPubkey: newPlanData.firstBurnerPubkey,
          hopCount: newPlanData.hopCount,
          amount: editedAmount,
        };
      }

      const { SystemProgram } = await import("@solana/web3.js");

      const signAndBroadcastOnce = async (): Promise<string> => {
        const blockhashRes = await fetch("/api/solana/blockhash", { cache: "no-store" });
        const bh = await blockhashRes.json().catch(() => null);
        if (!blockhashRes.ok || !bh?.blockhash || typeof bh?.lastValidBlockHeight !== "number") {
          throw new Error(typeof bh?.error === "string" ? bh.error : "Failed to fetch latest blockhash");
        }

        const tx = new Transaction();
        tx.recentBlockhash = String(bh.blockhash);
        tx.lastValidBlockHeight = Number(bh.lastValidBlockHeight);
        tx.feePayer = publicKey;
        tx.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(planData.firstBurnerPubkey),
            lamports: Number(solToLamports(planData.amount)),
          })
        );

        const signedTx = await signTransaction(tx);

        const sendRes = await fetch("/api/solana/send-raw-transaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txBase64: bytesToBase64(signedTx.serialize()),
            minContextSlot: typeof bh?.minContextSlot === "number" ? bh.minContextSlot : undefined,
            rpcUrl: typeof bh?.rpcUrl === "string" ? bh.rpcUrl : undefined,
            skipPreflight: false,
          }),
          cache: "no-store",
        });
        const sent = await sendRes.json().catch(() => null);
        if (!sendRes.ok || !sent?.signature) {
          const serverMsg = typeof sent?.error === "string" ? sent.error : "Failed to broadcast transaction";
          const code = typeof sent?.code === "string" ? sent.code : "";
          const err: any = new Error(serverMsg);
          err.code = code;
          err.status = sendRes.status;
          throw err;
        }

        return String(sent.signature);
      };

      let signature = "";
      try {
        signature = await signAndBroadcastOnce();
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        const code = String((e as any)?.code ?? "");
        const lower = msg.toLowerCase();
        const isBlockhash = code === "BLOCKHASH_NOT_FOUND" || lower.includes("blockhash not found");
        if (!isBlockhash) throw e;

        addMessage("assistant", "Blockhash expired while waiting for approval — please sign again to retry.");
        signature = await signAndBroadcastOnce();
      }

      // Close modal and update state
      setTransferModalData(null);
      
      setTransferState({
        planId: planData.id,
        status: "awaiting_funding",
        hopCount: planData.hopCount,
        currentHop: 0,
        firstBurnerPubkey: planData.firstBurnerPubkey,
        amountLamports: solToLamports(planData.amount).toString(),
      });

      addMessage(
        "assistant",
        `✅ Transfer signed! TX: \`${signature.slice(0, 12)}...\`\n\nNow applying privacy-preserving multi-hop routing...`
      );
      startTransferPolling({ planId: planData.id, fundingSignature: signature });

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const lower = msg.toLowerCase();

      // Wallet adapter throws when user cancels/rejects the signing prompt.
      if (lower.includes("user rejected") || lower.includes("rejected") || lower.includes("cancel")) {
        addMessage("assistant", "No worries~ Signature request cancelled. You can try again when you're ready!");
        return;
      }

      addMessage(
        "assistant",
        generateRoutingUpdate({
          currentHop: 0,
          totalHops: 0,
          status: "failed",
          error: msg,
        })
      );
      setTransferModalData(null);
    } finally {
      setIsModalSigning(false);
    }
  };

  const handleModalCancel = () => {
    setTransferModalData(null);
    addMessage("assistant", "Transfer cancelled~ Let me know if you want to try again!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isProcessing) return;

    setInputValue("");
    const userMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const parsed = parseUserMessage(text);

    switch (parsed.type) {
      case "help":
        addMessage("assistant", generateHelpResponse());
        break;

      case "balance":
        if (!connected || !publicKey) {
          addMessage("assistant", "Connect your wallet first to check your balance! 🔗");
        } else {
          const currentBalance = balanceInfo;
          if (currentBalance) {
            addMessage(
              "assistant",
              generateBalanceResponse({
                solBalance: currentBalance.sol,
                hasShipToken: currentBalance.hasShip,
              })
            );
          } else {
            addMessage("assistant", "Fetching your balance... Please try again in a moment!");
            await fetchBalance(publicKey.toBase58());
          }
        }
        break;

      case "transfer":
        await handleTransferCommand(parsed);
        break;

      case "status":
        if (transferState) {
          try {
            const res = await fetch(`/api/transfer/status?id=${encodeURIComponent(transferState.planId)}`, { cache: "no-store" });
            const st = await res.json();
            if (st?.error) {
              addMessage("assistant", `**Transfer Status**: ${transferState.status}\n**Progress**: ${transferState.currentHop}/${transferState.hopCount} hops`);
            } else {
              addMessage(
                "assistant",
                `**Transfer Status**: ${String(st.status)}\n**Progress**: ${Number(st?.state?.currentHop ?? 0)}/${Number(st?.plan?.hopCount ?? 0)} hops`
              );
            }
          } catch {
            addMessage("assistant", `**Transfer Status**: ${transferState.status}\n**Progress**: ${transferState.currentHop}/${transferState.hopCount} hops`);
          }
        } else {
          addMessage("assistant", "No active transfer. Start one by telling me what to send!");
        }
        break;

      default:
        try {
          const { reply, action } = await callAssistantChat({ userText: text, history: messages });
          if (typeof reply === "string" && reply.trim().length) {
            addMessage("assistant", reply.trim());
          } else {
            addMessage("assistant", generateUnknownResponse());
          }

          if (action && action.type === "transfer") {
            const amountSol = Number(action.amountSol);
            const destination = String(action.destination ?? "").trim();
            if (Number.isFinite(amountSol) && amountSol > 0 && destination) {
              await handleTransferCommand({
                type: "transfer",
                amount: amountSol,
                asset: "SOL",
                destination,
                raw: text,
              });
            }
          }
        } catch {
          addMessage("assistant", generateUnknownResponse());
        }
    }
  };

  return (
    <main className="swap-page">
      <div className="swap-container">
        {/* Hero Section */}
        <div className="swap-hero">
          <h1 className="swap-title"><span>Private</span> Token Transfers</h1>
          <p className="swap-subtitle">
            Untraceable transfers powered by zero-knowledge routing
          </p>
        </div>

        {/* Main Swap Card */}
        <div className="swap-card" style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Kawaii Background Image */}
          <img 
            src="/branding/main_swap_card_bg.png" 
            alt="" 
            className="swap-card-bg"
          />
          <div className="swap-card-header">
            <h2 className="swap-card-title">{effectiveSwapMode === "custodial" ? "AI Assisted" : "Non-Custodial"}</h2>
            <div className="swap-mode-tabs">
              <button
                className={`swap-mode-tab ${swapMode === "non-custodial" ? "swap-mode-tab--active" : ""}`}
                onClick={() => setSwapMode("non-custodial")}
              >
                Non-Custodial
              </button>
              <button
                className={`swap-mode-tab ${swapMode === "custodial" ? "swap-mode-tab--active" : ""}`}
                onClick={() => setSwapMode("custodial")}
              >
                AI Assisted
              </button>
            </div>
            </div>

          {/* Custodial Mode - Chat Interface */}
          {effectiveSwapMode === "custodial" && (
            <>
              {connected && balanceInfo && (
                <div className="swap-balance-row">
                  <span className="swap-balance-amount">{balanceInfo.sol.toFixed(4)} SOL</span>
                  {balanceInfo.hasShip && <span className="swap-balance-badge">Free Transfers</span>}
                </div>
              )}
              {/* Chat Messages */}
              <div className="swap-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`swap-message swap-message--${msg.role}`}>
                {msg.role === "assistant" && (
                  <div className="swap-avatar swap-avatar--anime">
                    <img src="/branding/AI_assistant_avatar.png" alt="UwU Assistant" />
                  </div>
                )}
                <div className="swap-message-content">
                  <div className="swap-message-text">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                  <div className="swap-message-time" suppressHydrationWarning>{formatTime(msg.timestamp)}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
              <form className="swap-input-area" onSubmit={handleSubmit}>
                {!connected ? (
                  <div className="swap-connect-prompt">
                    <p>Connect your wallet for AI assisted transfers</p>
                  </div>
                ) : (
                  <>
                    <input
                      ref={inputRef}
                      type="text"
                      className="swap-input"
                      placeholder="e.g., send 2 SOL privately to 9xj...abc"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      disabled={isProcessing}
                    />
                    <button type="submit" className="swap-send-btn" disabled={isProcessing || !inputValue.trim()}>
                      {isProcessing ? "Processing..." : "Send"}
                    </button>
                  </>
                )}
              </form>

              {/* Progress Overlay */}
              {transferState && (transferState.status === "routing" || transferState.status === "awaiting_funding") && (
                <div className="swap-progress">
                  <div className="swap-progress-bar">
                    <div
                      className="swap-progress-fill"
                      style={{
                        width: `${
                          transferState.status === "routing" && transferState.hopCount > 0
                            ? (transferState.currentHop / transferState.hopCount) * 100
                            : 5
                        }%`,
                      }}
                    />
                  </div>
                  <div className="swap-progress-text">
                    {transferState.status === "awaiting_funding"
                      ? "Waiting for funding confirmation..."
                      : `Routing hop ${transferState.currentHop} of ${transferState.hopCount}`}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Quick Send Mode - No Wallet Connect Required */}
          {effectiveSwapMode === "non-custodial" && (
            <div className="swap-noncustodial">
              {/* Initial Form State */}
              {!quickSendState && (
                <>
                  <div className="swap-noncustodial-info">
                    <h3>No Wallet Connect Required</h3>
                    <p>Send privately without connecting your wallet. Just like Houdini Swap.</p>
                  </div>
                  <div className="swap-noncustodial-form">
                    <div className="swap-noncustodial-field">
                      <label>Destination Address</label>
                      <input
                        type="text"
                        className="swap-input"
                        placeholder="Where should we send the funds?"
                        value={quickSendForm.destination}
                        onChange={(e) => setQuickSendForm(prev => ({ ...prev, destination: e.target.value }))}
                        disabled={isQuickSendLoading}
                      />
                    </div>
                    <div className="swap-noncustodial-field">
                      <label>Amount (SOL)</label>
                      <input
                        type="number"
                        className="swap-input"
                        placeholder="0.00"
                        step="0.001"
                        min="0"
                        value={quickSendForm.amount}
                        onChange={(e) => setQuickSendForm(prev => ({ ...prev, amount: e.target.value }))}
                        disabled={isQuickSendLoading}
                      />
                    </div>
                    <button 
                      className="swap-send-btn"
                      onClick={handleGenerateDepositAddress}
                      disabled={isQuickSendLoading || !quickSendForm.destination || !quickSendForm.amount}
                    >
                      {isQuickSendLoading ? "Creating..." : "Generate Deposit Address"}
                    </button>
                  </div>
                  <div className="swap-noncustodial-steps">
                    <div className="swap-noncustodial-step">
                      <span className="swap-step-num">1</span>
                      <span>Enter destination & amount</span>
                    </div>
                    <div className="swap-noncustodial-step">
                      <span className="swap-step-num">2</span>
                      <span>Send SOL to the deposit address</span>
                    </div>
                <div className="swap-noncustodial-step">
                      <span className="swap-step-num">3</span>
                      <span>We route privately to destination</span>
                    </div>
                  </div>
                  <div className="swap-noncustodial-note swap-noncustodial-note--success">
                    <span>✅</span> Fully private. No wallet connection. No on-chain link.
                  </div>
                </>
              )}

              {/* Tracking State - Awaiting Deposit */}
              {quickSendState && quickSendState.status === "awaiting_deposit" && (
                <div className="swap-tracking">
                  <div className="swap-tracking-header">
                    <div className="swap-tracking-status swap-tracking-status--waiting">
                      <span className="swap-tracking-pulse"></span>
                      Awaiting Deposit
                    </div>
                    <div className="swap-tracking-timer">{formatElapsedTime(elapsedTime)}</div>
                  </div>
                  
                  <div className="swap-tracking-deposit">
                    <label>Send {quickSendState.amount} SOL to:</label>
                    <div className="swap-tracking-address">
                      <code>{quickSendState.depositAddress}</code>
                      <button className="swap-copy-btn" title="Copy address" onClick={() => copyToClipboard(quickSendState.depositAddress)}>📋</button>
                    </div>
                  </div>

                  <div className="swap-tracking-info">
                    <div className="swap-tracking-row">
                      <span>Destination</span>
                      <span>{quickSendState.destinationAddress.slice(0, 8)}...{quickSendState.destinationAddress.slice(-6)}</span>
                    </div>
                    <div className="swap-tracking-row">
                      <span>Amount</span>
                      <span>{quickSendState.amount} SOL</span>
                    </div>
                    {quickSendState.feeApplied && typeof quickSendState.feeSol === "number" && (
                      <div className="swap-tracking-row">
                        <span>Fee</span>
                        <span>{quickSendState.feeSol.toFixed(6)} SOL</span>
                      </div>
                    )}
                    {typeof quickSendState.netAmount === "number" && (
                      <div className="swap-tracking-row">
                        <span>Net to destination</span>
                        <span>{quickSendState.netAmount.toFixed(6)} SOL</span>
                      </div>
                    )}
                    {quickSendState.depositBalanceLamports && quickSendState.requiredLamports && (
                      <div className="swap-tracking-row">
                        <span>Deposit balance</span>
                        <span>{quickSendState.depositBalanceLamports} / {quickSendState.requiredLamports} lamports</span>
                      </div>
                    )}
                    {quickSendState.fundingExpiresAtUnixMs && (
                      <div className="swap-tracking-row">
                        <span>Deposit expires in</span>
                        <span>{formatExpiresIn(quickSendState.fundingExpiresAtUnixMs)}</span>
                      </div>
                    )}
                    <div className="swap-tracking-row">
                      <span>Est. Arrival</span>
                      <span>{getEstimatedRemaining()}</span>
                    </div>
                  </div>
                  <button className="swap-cancel-btn" onClick={resetQuickSend}>
                    Cancel
                  </button>
                </div>
              )}

              {/* Tracking State - Routing */}
              {quickSendState && quickSendState.status === "routing" && (
                <div className="swap-tracking">
                  <div className="swap-tracking-header">
                    <div className="swap-tracking-status swap-tracking-status--routing">
                      <span className="swap-tracking-pulse swap-tracking-pulse--active"></span>
                      Routing...
                    </div>
                    <div className="swap-tracking-timer">{formatElapsedTime(elapsedTime)}</div>
                  </div>

                  <div className="swap-tracking-progress">
                    <div className="swap-tracking-progress-bar">
                      <div 
                        className="swap-tracking-progress-fill"
                        style={{ width: `${(quickSendState.currentHop / quickSendState.hopCount) * 100}%` }}
                      />
                    </div>
                    <div className="swap-tracking-progress-text">
                      Hop {quickSendState.currentHop} of {quickSendState.hopCount}
                    </div>
                  </div>

                  <div className="swap-tracking-hops">
                    {Array.from({ length: quickSendState.hopCount }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`swap-tracking-hop ${i < quickSendState.currentHop ? 'swap-tracking-hop--complete' : i === quickSendState.currentHop ? 'swap-tracking-hop--active' : ''}`}
                      >
                        <span className="swap-hop-icon">{i < quickSendState.currentHop ? '✓' : i === quickSendState.currentHop ? '◉' : '○'}</span>
                        <span>Hop {i + 1}</span>
                      </div>
                    ))}
                  </div>

                  <div className="swap-tracking-info">
                    <div className="swap-tracking-row">
                      <span>Est. Arrival</span>
                      <span>{getEstimatedRemaining()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tracking State - Complete */}
              {quickSendState && quickSendState.status === "complete" && (
                <div className="swap-tracking swap-tracking--complete">
                  <div className="swap-tracking-success">
                    <div className="swap-tracking-success-icon">✅</div>
                    <h3>Transfer Complete!</h3>
                    <p>Funds have arrived at destination</p>
                  </div>

                  <div className="swap-tracking-info">
                    <div className="swap-tracking-row">
                      <span>Amount Sent</span>
                      <span>{quickSendState.amount} SOL</span>
                    </div>
                    <div className="swap-tracking-row">
                      <span>Total Time</span>
                      <span>{formatElapsedTime(elapsedTime)}</span>
                    </div>
                    <div className="swap-tracking-row">
                      <span>Hops Used</span>
                      <span>{quickSendState.hopCount}</span>
                    </div>
                    {quickSendState.txSignature && (
                      <div className="swap-tracking-row">
                        <span>Final TX</span>
                        <span className="swap-tracking-tx">{quickSendState.txSignature.slice(0, 8)}...</span>
                      </div>
                    )}
                  </div>

                  <button className="swap-send-btn" onClick={resetQuickSend}>
                    New Transfer
                  </button>
                </div>
              )}

              {quickSendState && quickSendState.status === "failed" && (
                <div className="swap-tracking swap-tracking--complete">
                  <div className="swap-tracking-success">
                    <div className="swap-tracking-success-icon">❌</div>
                    <h3>Transfer Failed</h3>
                    <p>{quickSendState.lastError || "Transfer failed"}</p>
                  </div>
                  <button className="swap-send-btn" onClick={resetQuickSend}>
                    New Transfer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        </div>

      {/* Transfer Confirmation Modal */}
      <TransferModal
        isOpen={!!transferModalData}
        data={transferModalData}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
        isLoading={isModalSigning}
      />
    </main>
  );
}

function formatTime(ts: number): string {
  if (ts === 0) return ""; // Hide time for initial message
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
