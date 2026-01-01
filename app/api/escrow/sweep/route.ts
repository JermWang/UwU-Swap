import { NextResponse } from "next/server";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";

import { checkRateLimit } from "../../../lib/rateLimit";
import { getSafeErrorMessage } from "../../../lib/safeError";
import { getConnection } from "../../../lib/solana";
import { getClaimableCreatorFeeLamports, buildCollectCreatorFeeInstruction } from "../../../lib/pumpfun";
import { privySignAndSendSolanaTransaction } from "../../../lib/privy";
import { getCommitment, updateRewardTotalsAndMilestones, getEscrowSignerRef } from "../../../lib/escrowStore";

export const runtime = "nodejs";

const SOLANA_CAIP2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"; // mainnet

/**
 * POST /api/escrow/sweep
 * 
 * Auto-escrow flow for managed commitments:
 * 1. Check if the commitment uses a Privy-managed creator wallet
 * 2. Check claimable creator fees in the Pump.fun creator vault
 * 3. Claim fees to the creator wallet
 * 4. Transfer claimed fees to the escrow address
 * 5. Update commitment totals
 * 
 * This should be called periodically (cron) or triggered after trades.
 */
export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(req, { keyPrefix: "escrow:sweep", limit: 30, windowSeconds: 60 });
    if (!rl.allowed) {
      const res = NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
      res.headers.set("retry-after", String(rl.retryAfterSeconds));
      return res;
    }

    const body = (await req.json()) as any;
    const commitmentId = typeof body.commitmentId === "string" ? body.commitmentId.trim() : "";

    if (!commitmentId) {
      return NextResponse.json({ error: "commitmentId is required" }, { status: 400 });
    }

    // Get commitment record
    const record = await getCommitment(commitmentId);
    if (!record) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    if (record.kind !== "creator_reward") {
      return NextResponse.json({ error: "Not a creator reward commitment" }, { status: 400 });
    }

    if (record.creatorFeeMode !== "managed") {
      return NextResponse.json({ error: "Commitment is not in managed mode" }, { status: 400 });
    }

    // Check if this commitment uses a Privy-managed wallet
    const signerRef = getEscrowSignerRef(record);
    if (signerRef.kind !== "privy") {
      return NextResponse.json({ error: "Commitment does not use a Privy-managed wallet" }, { status: 400 });
    }

    const privyWalletId = signerRef.walletId;
    const connection = getConnection();

    // The creator wallet is stored in record.authority for managed commitments
    // For managed mode, authority = the Privy-controlled creator wallet
    // record.creatorPubkey = the user's payout wallet
    const creatorWallet = new PublicKey(record.authority);
    const escrowPubkey = new PublicKey(record.escrowPubkey);

    // Step 1: Check claimable fees in Pump.fun creator vault
    const { claimableLamports, creatorVault } = await getClaimableCreatorFeeLamports({
      connection,
      creator: creatorWallet,
    });

    if (claimableLamports <= 0) {
      return NextResponse.json({
        ok: true,
        swept: false,
        message: "No claimable fees",
        claimableLamports: 0,
      });
    }

    // Step 2: Build transaction to claim fees and transfer to escrow
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("processed");

    // Claim instruction - moves fees from creator vault to creator wallet
    const { ix: claimIx } = buildCollectCreatorFeeInstruction({ creator: creatorWallet });

    // Transfer instruction - moves claimed fees from creator wallet to escrow
    // Leave a small buffer for rent
    const transferAmount = Math.max(0, claimableLamports - 5000);
    const transferIx = SystemProgram.transfer({
      fromPubkey: creatorWallet,
      toPubkey: escrowPubkey,
      lamports: transferAmount,
    });

    const tx = new Transaction();
    tx.feePayer = creatorWallet;
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.add(claimIx);
    tx.add(transferIx);

    // Step 3: Sign and send via Privy
    const txBase64 = tx.serialize({ requireAllSignatures: false }).toString("base64");

    const { signature } = await privySignAndSendSolanaTransaction({
      walletId: privyWalletId,
      caip2: SOLANA_CAIP2,
      transactionBase64: txBase64,
    });

    // Step 4: Update commitment totals
    const newTotalFunded = (record.totalFundedLamports ?? 0) + transferAmount;

    await updateRewardTotalsAndMilestones({
      id: commitmentId,
      totalFundedLamports: newTotalFunded,
    });

    return NextResponse.json({
      ok: true,
      swept: true,
      claimedLamports: claimableLamports,
      transferredLamports: transferAmount,
      newTotalFundedLamports: newTotalFunded,
      signature,
      creatorVault: creatorVault.toBase58(),
      escrowPubkey: escrowPubkey.toBase58(),
    });

  } catch (e) {
    console.error("Sweep error:", e);
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}
