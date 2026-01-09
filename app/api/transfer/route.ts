import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

import { getConnection } from "../../lib/rpc";
import {
  createRoutingPlan,
  serializeRoutingPlan,
  TransferAsset,
} from "../../lib/uwuRouter";
import { solToLamports } from "../../lib/uwuChat";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fromWallet, toWallet, amountSol, asset } = body;

    // Validate inputs
    if (!fromWallet || typeof fromWallet !== "string") {
      return NextResponse.json({ error: "Missing fromWallet" }, { status: 400 });
    }
    if (!toWallet || typeof toWallet !== "string") {
      return NextResponse.json({ error: "Missing toWallet" }, { status: 400 });
    }
    if (typeof amountSol !== "number" || amountSol <= 0) {
      return NextResponse.json({ error: "Invalid amountSol" }, { status: 400 });
    }

    // Validate wallet addresses
    try {
      new PublicKey(fromWallet);
      new PublicKey(toWallet);
    } catch {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const connection = getConnection();
    const transferAsset: TransferAsset = asset?.mint ? { mint: asset.mint } : "SOL";
    const amountLamports = solToLamports(amountSol);

    // Create routing plan
    const plan = await createRoutingPlan({
      connection,
      fromWallet,
      toWallet,
      asset: transferAsset,
      amountLamports,
    });

    // Serialize for client
    const serialized = serializeRoutingPlan(plan);

    // Return plan details (excluding secrets for now - those stay server-side)
    return NextResponse.json({
      id: plan.id,
      hopCount: plan.hops.length,
      estimatedCompletionMs: plan.estimatedCompletionMs,
      feeApplied: plan.feeApplied,
      feeLamports: plan.feeLamports.toString(),
      firstBurnerPubkey: plan.burnerWallets[0].publicKey.toBase58(),
      // Store serialized plan server-side in production (DB/Redis)
      // For now, return encrypted or keep in memory
      _debug: {
        burnerCount: plan.burnerWallets.length,
      },
    });
  } catch (e) {
    console.error("Transfer plan error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
