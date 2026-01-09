import { Connection, PublicKey } from "@solana/web3.js";
import { v4 as uuidv4 } from "uuid";

import { privyCreateSolanaWallet } from "./privy";
import { checkUwuTokenHolder, calculateFee, getTreasuryWallet, TransferAsset } from "./uwuRouter";

const MIN_HOPS = 2;
const MAX_HOPS = 5;
const MIN_HOP_DELAY_MS = 500;
const MAX_HOP_DELAY_MS = 3000;

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

  const estimatedCompletionMs = totalDelayMs + hopCount * 2000;
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
