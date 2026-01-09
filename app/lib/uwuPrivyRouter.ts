import { Connection, PublicKey } from "@solana/web3.js";
import { v4 as uuidv4 } from "uuid";

import { privyCreateSolanaWallet } from "./privy";
import { checkUwuTokenHolder, calculateFee, getTreasuryWallet, TransferAsset } from "./uwuRouter";

const MIN_HOPS = 7;
const MAX_HOPS = 12;
const MIN_HOP_DELAY_MS = 500;
const MAX_HOP_DELAY_MS = 3000;

// Minimum total transfer time (2-5 minutes) for timing obfuscation
export const MIN_TRANSFER_TIME_MS = 120_000; // 2 minutes minimum
export const MAX_TRANSFER_TIME_MS = 300_000; // 5 minutes maximum

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDelayMs(): number {
  return randomInt(MIN_HOP_DELAY_MS, MAX_HOP_DELAY_MS);
}

export type PrivyBurnerWallet = {
  walletId: string;
  address: string;
};

export type UwuPrivyHopResult = {
  index: number;
  signature: string;
  success: boolean;
  error?: string;
};

export type UwuPrivyTransferData = {
  plan: {
    id: string;
    fromWallet: string;
    toWallet: string;
    asset: TransferAsset;
    amountLamports: string;
    netAmountLamports: string;
    hopCount: number;
    burners: PrivyBurnerWallet[];
    hopDelaysMs: number[];
    estimatedCompletionMs: number;
    feeApplied: boolean;
    feeLamports: string;
    createdAtUnix: number;
  };
  state: {
    funded: boolean;
    fundingSignature?: string;
    fundingSignatureSetAtUnixMs?: number;
    feeCollected: boolean;
    feeSignature?: string;
    currentHop: number;
    hopResults: UwuPrivyHopResult[];
    finalSignature?: string;
    nextActionAtUnixMs: number;
    lastError?: string;
    inFlight?: {
      action: string;
      startedAtUnixMs: number;
    };
  };
};

export async function createPrivyRoutingPlan(input: {
  connection: Connection;
  fromWallet: string;
  toWallet: string;
  asset: TransferAsset;
  amountLamports: bigint;
}): Promise<UwuPrivyTransferData> {
  const { connection, fromWallet, toWallet, asset } = input;
  const amountLamports = BigInt(input.amountLamports);

  const id = uuidv4();
  const fromPubkey = new PublicKey(fromWallet);
  new PublicKey(toWallet);

  const isUwuHolder = await checkUwuTokenHolder(connection, fromPubkey);
  const feeLamports = calculateFee(amountLamports, !isUwuHolder);
  const netAmountLamports = amountLamports - feeLamports;

  if (feeLamports > 0n) {
    const treasury = getTreasuryWallet();
    if (!treasury) {
      throw new Error("UWU_TREASURY_WALLET is required when fees are enabled (non-$UWU holders)");
    }
  }

  const hopCount = randomInt(MIN_HOPS, MAX_HOPS);

  const burners: PrivyBurnerWallet[] = [];
  for (let i = 0; i < hopCount; i++) {
    const w = await privyCreateSolanaWallet();
    burners.push({ walletId: w.walletId, address: w.address });
  }

  const hopDelaysMs: number[] = [];
  let totalDelayMs = 0;
  for (let i = 0; i < hopCount; i++) {
    const d = randomDelayMs();
    hopDelaysMs.push(d);
    totalDelayMs += d;
  }

  // Estimated time is the larger of: actual hop time OR minimum obfuscation time (2-5 min)
  const hopExecutionTime = totalDelayMs + hopCount * 2000;
  const randomMinTime = MIN_TRANSFER_TIME_MS + Math.random() * (MAX_TRANSFER_TIME_MS - MIN_TRANSFER_TIME_MS);
  const estimatedCompletionMs = Math.max(hopExecutionTime, randomMinTime);
  const nowUnix = Math.floor(Date.now() / 1000);
  const feeCollected = feeLamports === 0n;

  return {
    plan: {
      id,
      fromWallet,
      toWallet,
      asset,
      amountLamports: amountLamports.toString(),
      netAmountLamports: netAmountLamports.toString(),
      hopCount,
      burners,
      hopDelaysMs,
      estimatedCompletionMs,
      feeApplied: !isUwuHolder,
      feeLamports: feeLamports.toString(),
      createdAtUnix: nowUnix,
    },
    state: {
      funded: false,
      feeCollected,
      currentHop: 0,
      hopResults: [],
      nextActionAtUnixMs: Date.now(),
    },
  };
}
