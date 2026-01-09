import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

import { getConnection, getServerCommitment, withRetry } from "../../lib/rpc";
import { checkUwuTokenHolder } from "../../lib/uwuRouter";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet parameter" }, { status: 400 });
    }

    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(wallet);
    } catch {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const connection = getConnection();
    const commitment = getServerCommitment();

    const [balanceLamports, hasUwuToken] = await Promise.all([
      withRetry(() => connection.getBalance(pubkey, commitment)),
      checkUwuTokenHolder(connection, pubkey),
    ]);

    const balanceSol = balanceLamports / 1_000_000_000;

    return NextResponse.json({
      wallet,
      balanceLamports,
      balanceSol,
      hasUwuToken,
      feeWaived: hasUwuToken,
    });
  } catch (e) {
    console.error("Balance check error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
