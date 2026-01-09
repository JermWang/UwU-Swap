import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

import { getConnection } from "../../lib/rpc";
import { resolveAddressOrDomain } from "../../lib/solDomains";
import { TransferAsset } from "../../lib/uwuRouter";
import { solToLamports } from "../../lib/uwuChat";
import { getSafeErrorMessage } from "../../lib/safeError";
import { createUwuTransfer } from "../../lib/uwuTransferStore";
import { createPrivyRoutingPlan, UwuPrivyTransferData } from "../../lib/uwuPrivyRouter";

export const runtime = "nodejs";

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

    const connection = getConnection();

    // Validate fromWallet and resolve destination (supports .sol domains)
    try {
      new PublicKey(fromWallet);
    } catch {
      return NextResponse.json({ error: "Invalid fromWallet" }, { status: 400 });
    }

    const resolved = await resolveAddressOrDomain(toWallet, connection);
    if (!resolved) {
      return NextResponse.json({ error: "Invalid toWallet" }, { status: 400 });
    }

    const transferAsset: TransferAsset = asset?.mint ? { mint: asset.mint } : "SOL";
    const amountLamports = solToLamports(amountSol);

    // Create a Privy-managed routing plan (burner keys never leave Privy)
    const data = await createPrivyRoutingPlan({
      connection,
      fromWallet,
      toWallet: resolved.pubkey.toBase58(),
      asset: transferAsset,
      amountLamports,
    });

    // Persist plan + state server-side
    await createUwuTransfer<UwuPrivyTransferData>({
      id: data.plan.id,
      status: "awaiting_funding",
      data,
    });

    // Return public details only
    return NextResponse.json({
      id: data.plan.id,
      hopCount: data.plan.hopCount,
      estimatedCompletionMs: data.plan.estimatedCompletionMs,
      feeApplied: data.plan.feeApplied,
      feeLamports: data.plan.feeLamports,
      firstBurnerPubkey: data.plan.burners[0]?.address,
      resolvedToWallet: resolved.pubkey.toBase58(),
    });
  } catch (e) {
    console.error("Transfer plan error:", e);
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}
