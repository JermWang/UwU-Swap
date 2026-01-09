import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { v4 as uuidv4 } from "uuid";

import { getConnection, getServerCommitment, withRetry, confirmSignatureViaRpc } from "./rpc";
import {
  getAssociatedTokenAddress,
  buildCreateAssociatedTokenAccountIdempotentInstruction,
  buildSplTokenTransferInstruction,
  getTokenProgramIdForMint,
  hasAnyTokenBalanceForMint,
} from "./solana";

// ============================================================================
// Configuration
// ============================================================================

export const FEE_BPS = 50; // 0.5% fee for non-$UWU holders
const MIN_HOPS = 2;
const MAX_HOPS = 5;
const MIN_HOP_DELAY_MS = 500;
const MAX_HOP_DELAY_MS = 3000;

// Lazy-loaded config to avoid build-time errors with invalid env vars
let _shipTokenMint: PublicKey | null = null;
let _treasuryWallet: PublicKey | null = null;

export function getUwuTokenMint(): PublicKey | null {
  if (_shipTokenMint) return _shipTokenMint;
  const raw = (process.env.UWU_TOKEN_MINT?.trim() || process.env.SHIP_TOKEN_MINT?.trim()) ?? "";
  if (!raw) return null;
  try {
    _shipTokenMint = new PublicKey(raw);
    return _shipTokenMint;
  } catch {
    return null;
  }
}

export function getTreasuryWallet(): PublicKey | null {
  if (_treasuryWallet) return _treasuryWallet;
  const raw = process.env.UWU_TREASURY_WALLET?.trim();
  if (!raw) return null;
  try {
    _treasuryWallet = new PublicKey(raw);
    return _treasuryWallet;
  } catch {
    return null;
  }
}

// ============================================================================
// Types
// ============================================================================

export type TransferAsset = "SOL" | { mint: string };

export type TransferRequest = {
  id: string;
  fromWallet: string;
  toWallet: string;
  asset: TransferAsset;
  amountLamports: bigint; // For SOL, lamports; for SPL, raw token amount
  createdAtUnix: number;
};

export type HopPlan = {
  index: number;
  fromKeypair: Keypair;
  toPublicKey: PublicKey;
  amountLamports: bigint;
  delayMs: number;
};

export type RoutingPlan = {
  id: string;
  request: TransferRequest;
  hops: HopPlan[];
  burnerWallets: Keypair[];
  estimatedCompletionMs: number;
  feeApplied: boolean;
  feeLamports: bigint;
};

export type HopResult = {
  index: number;
  signature: string;
  success: boolean;
  error?: string;
};

export type TransferResult = {
  id: string;
  success: boolean;
  hopResults: HopResult[];
  totalTimeMs: number;
  finalSignature?: string;
  error?: string;
};

// ============================================================================
// Ephemeral Wallet Generation
// ============================================================================

export function generateBurnerWallets(count: number): Keypair[] {
  const wallets: Keypair[] = [];
  for (let i = 0; i < count; i++) {
    wallets.push(Keypair.generate());
  }
  return wallets;
}

export function keypairToBase58(kp: Keypair): string {
  return bs58.encode(kp.secretKey);
}

export function keypairFromBase58(secret: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(secret));
}

// ============================================================================
// Fee Logic
// ============================================================================

export async function checkUwuTokenHolder(connection: Connection, wallet: PublicKey): Promise<boolean> {
  const uwuMint = getUwuTokenMint();
  if (!uwuMint) return false; // No UWU token configured, treat as non-holder
  try {
    return await hasAnyTokenBalanceForMint({ connection, owner: wallet, mint: uwuMint });
  } catch {
    return false;
  }
}

export function calculateFee(amountLamports: bigint, applyFee: boolean): bigint {
  if (!applyFee) return 0n;
  return (amountLamports * BigInt(FEE_BPS)) / 10000n;
}

// ============================================================================
// Routing Plan Generation
// ============================================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDelay(): number {
  return randomInt(MIN_HOP_DELAY_MS, MAX_HOP_DELAY_MS);
}

export async function createRoutingPlan(input: {
  connection: Connection;
  fromWallet: string;
  toWallet: string;
  asset: TransferAsset;
  amountLamports: bigint;
}): Promise<RoutingPlan> {
  const { connection, fromWallet, toWallet, asset, amountLamports } = input;

  const id = uuidv4();
  const fromPubkey = new PublicKey(fromWallet);
  const toPubkey = new PublicKey(toWallet);

  // Check if sender holds $UWU token
  const isUwuHolder = await checkUwuTokenHolder(connection, fromPubkey);
  const feeLamports = calculateFee(amountLamports, !isUwuHolder);
  const netAmount = amountLamports - feeLamports;

  // Generate random number of hops
  const hopCount = randomInt(MIN_HOPS, MAX_HOPS);
  const burnerWallets = generateBurnerWallets(hopCount);

  // Build hop chain: source -> burner1 -> burner2 -> ... -> destination
  const hops: HopPlan[] = [];
  let totalDelayMs = 0;

  for (let i = 0; i < hopCount + 1; i++) {
    const isFirstHop = i === 0;
    const isLastHop = i === hopCount;

    // For first hop, we don't have a keypair yet (user signs)
    // For intermediate hops, use burner keypairs
    const fromKeypair = isFirstHop ? Keypair.generate() : burnerWallets[i - 1]; // Placeholder for first hop
    const toKey = isLastHop ? toPubkey : burnerWallets[i].publicKey;

    const delayMs = isFirstHop ? 0 : randomDelay();
    totalDelayMs += delayMs;

    hops.push({
      index: i,
      fromKeypair,
      toPublicKey: toKey,
      amountLamports: netAmount, // Each hop transfers the full net amount
      delayMs,
    });
  }

  const request: TransferRequest = {
    id,
    fromWallet,
    toWallet,
    asset,
    amountLamports,
    createdAtUnix: Math.floor(Date.now() / 1000),
  };

  return {
    id,
    request,
    hops,
    burnerWallets,
    estimatedCompletionMs: totalDelayMs + hopCount * 2000, // Add ~2s per hop for tx confirmation
    feeApplied: !isUwuHolder,
    feeLamports,
  };
}

// ============================================================================
// Transfer Execution
// ============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function executeSOLHop(input: {
  connection: Connection;
  from: Keypair;
  to: PublicKey;
  lamports: bigint;
}): Promise<string> {
  const { connection, from, to, lamports } = input;
  const commitment = getServerCommitment();

  const { blockhash, lastValidBlockHeight } = await withRetry(() =>
    connection.getLatestBlockhash(commitment)
  );

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = from.publicKey;

  tx.add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports: Number(lamports),
    })
  );

  tx.sign(from);
  const raw = tx.serialize();

  const signature = await withRetry(() =>
    connection.sendRawTransaction(raw, {
      skipPreflight: false,
      preflightCommitment: commitment,
    })
  );

  await confirmSignatureViaRpc(connection, signature, commitment);
  return signature;
}

async function executeSPLHop(input: {
  connection: Connection;
  from: Keypair;
  to: PublicKey;
  mint: PublicKey;
  amountRaw: bigint;
}): Promise<string> {
  const { connection, from, to, mint, amountRaw } = input;
  const commitment = getServerCommitment();

  const tokenProgram = await getTokenProgramIdForMint({ connection, mint });
  const sourceAta = getAssociatedTokenAddress({ owner: from.publicKey, mint, tokenProgram });
  const { ix: createAtaIx, ata: destAta } = buildCreateAssociatedTokenAccountIdempotentInstruction({
    payer: from.publicKey,
    owner: to,
    mint,
    tokenProgram,
  });
  const transferIx = buildSplTokenTransferInstruction({
    sourceAta,
    destinationAta: destAta,
    owner: from.publicKey,
    amountRaw,
    tokenProgram,
  });

  const { blockhash, lastValidBlockHeight } = await withRetry(() =>
    connection.getLatestBlockhash(commitment)
  );

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = from.publicKey;
  tx.add(createAtaIx);
  tx.add(transferIx);

  tx.sign(from);
  const raw = tx.serialize();

  const signature = await withRetry(() =>
    connection.sendRawTransaction(raw, {
      skipPreflight: false,
      preflightCommitment: commitment,
    })
  );

  await confirmSignatureViaRpc(connection, signature, commitment);
  return signature;
}

export async function executeRoutingPlan(input: {
  connection: Connection;
  plan: RoutingPlan;
  fundedBurnerIndex: number; // Index of first burner that has been funded by user
}): Promise<TransferResult> {
  const { connection, plan, fundedBurnerIndex } = input;
  const startTime = Date.now();
  const hopResults: HopResult[] = [];

  const isSol = plan.request.asset === "SOL";
  const mint = isSol ? null : new PublicKey((plan.request.asset as { mint: string }).mint);

  // Execute hops starting from the funded burner
  for (let i = fundedBurnerIndex; i < plan.hops.length; i++) {
    const hop = plan.hops[i];

    // Wait for delay (adds randomness/obfuscation)
    if (hop.delayMs > 0) {
      await sleep(hop.delayMs);
    }

    try {
      let signature: string;

      if (isSol) {
        signature = await executeSOLHop({
          connection,
          from: plan.burnerWallets[i - 1] || plan.burnerWallets[0],
          to: hop.toPublicKey,
          lamports: hop.amountLamports,
        });
      } else {
        signature = await executeSPLHop({
          connection,
          from: plan.burnerWallets[i - 1] || plan.burnerWallets[0],
          to: hop.toPublicKey,
          mint: mint!,
          amountRaw: hop.amountLamports,
        });
      }

      hopResults.push({
        index: i,
        signature,
        success: true,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      hopResults.push({
        index: i,
        signature: "",
        success: false,
        error,
      });

      return {
        id: plan.id,
        success: false,
        hopResults,
        totalTimeMs: Date.now() - startTime,
        error: `Hop ${i} failed: ${error}`,
      };
    }
  }

  const lastResult = hopResults[hopResults.length - 1];

  return {
    id: plan.id,
    success: true,
    hopResults,
    totalTimeMs: Date.now() - startTime,
    finalSignature: lastResult?.signature,
  };
}

// ============================================================================
// User-Facing Transaction Building
// ============================================================================

export function buildInitialFundingTransaction(input: {
  userPubkey: PublicKey;
  firstBurnerPubkey: PublicKey;
  lamports: bigint;
  recentBlockhash: string;
  lastValidBlockHeight: number;
}): Transaction {
  const { userPubkey, firstBurnerPubkey, lamports, recentBlockhash, lastValidBlockHeight } = input;

  const tx = new Transaction();
  tx.recentBlockhash = recentBlockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = userPubkey;

  tx.add(
    SystemProgram.transfer({
      fromPubkey: userPubkey,
      toPubkey: firstBurnerPubkey,
      lamports: Number(lamports),
    })
  );

  return tx;
}

// ============================================================================
// Plan Serialization (for persistence/resumption)
// ============================================================================

export type SerializedTransferRequest = Omit<TransferRequest, "amountLamports"> & {
  amountLamports: string;
};

export type SerializedRoutingPlan = {
  id: string;
  request: SerializedTransferRequest;
  burnerSecrets: string[];
  estimatedCompletionMs: number;
  feeApplied: boolean;
  feeLamports: string;
};

export function serializeRoutingPlan(plan: RoutingPlan): SerializedRoutingPlan {
  return {
    id: plan.id,
    request: {
      ...plan.request,
      amountLamports: plan.request.amountLamports.toString(),
    },
    burnerSecrets: plan.burnerWallets.map(keypairToBase58),
    estimatedCompletionMs: plan.estimatedCompletionMs,
    feeApplied: plan.feeApplied,
    feeLamports: plan.feeLamports.toString(),
  };
}

export function deserializeRoutingPlan(data: SerializedRoutingPlan): RoutingPlan {
  const burnerWallets = data.burnerSecrets.map(keypairFromBase58);
  const amountLamports = BigInt(data.request.amountLamports);
  const feeLamports = BigInt(data.feeLamports);
  const netAmount = amountLamports - feeLamports;

  const toPubkey = new PublicKey(data.request.toWallet);

  const hops: HopPlan[] = [];
  for (let i = 0; i < burnerWallets.length + 1; i++) {
    const isFirstHop = i === 0;
    const isLastHop = i === burnerWallets.length;

    const fromKeypair = isFirstHop ? Keypair.generate() : burnerWallets[i - 1];
    const toKey = isLastHop ? toPubkey : burnerWallets[i].publicKey;

    hops.push({
      index: i,
      fromKeypair,
      toPublicKey: toKey,
      amountLamports: netAmount,
      delayMs: isFirstHop ? 0 : randomInt(MIN_HOP_DELAY_MS, MAX_HOP_DELAY_MS),
    });
  }

  return {
    id: data.id,
    request: {
      ...data.request,
      amountLamports,
    },
    hops,
    burnerWallets,
    estimatedCompletionMs: data.estimatedCompletionMs,
    feeApplied: data.feeApplied,
    feeLamports,
  };
}

// ============================================================================
// Utility Exports
// ============================================================================
