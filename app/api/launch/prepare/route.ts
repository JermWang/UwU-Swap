import { NextResponse } from "next/server";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { Buffer } from "buffer";

import { checkRateLimit } from "../../../lib/rateLimit";
import { getSafeErrorMessage } from "../../../lib/safeError";
import { getConnection } from "../../../lib/solana";
import { privyCreateSolanaWallet } from "../../../lib/privy";
import { auditLog } from "../../../lib/auditLog";
import { getAdminCookieName, getAdminSessionWallet, getAllowedAdminWallets, verifyAdminOrigin } from "../../../lib/adminSession";

export const runtime = "nodejs";

function isPublicLaunchEnabled(): boolean {
  const raw = String(process.env.CTS_PUBLIC_LAUNCHES ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export async function GET() {
  const res = NextResponse.json({ error: "Method Not Allowed. Use POST /api/launch/prepare." }, { status: 405 });
  res.headers.set("allow", "POST, OPTIONS");
  return res;
}

export async function OPTIONS(req: Request) {
  const expected = String(process.env.APP_ORIGIN ?? "").trim();
  const origin = req.headers.get("origin") ?? "";

  try {
    verifyAdminOrigin(req);
  } catch {
    const res = new NextResponse(null, { status: 204 });
    res.headers.set("allow", "POST, OPTIONS");
    return res;
  }

  const res = new NextResponse(null, { status: 204 });
  res.headers.set("allow", "POST, OPTIONS");
  res.headers.set("access-control-allow-origin", origin || expected);
  res.headers.set("access-control-allow-methods", "POST, OPTIONS");
  res.headers.set("access-control-allow-headers", "content-type");
  res.headers.set("access-control-allow-credentials", "true");
  res.headers.set("vary", "origin");
  return res;
}

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(req, { keyPrefix: "launch:prepare", limit: 10, windowSeconds: 60 });
    if (!rl.allowed) {
      const res = NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
      res.headers.set("retry-after", String(rl.retryAfterSeconds));
      return res;
    }

    verifyAdminOrigin(req);

    if (!isPublicLaunchEnabled()) {
      const cookieHeader = String(req.headers.get("cookie") ?? "");
      const hasAdminCookie = cookieHeader.includes(`${getAdminCookieName()}=`);
      const allowed = getAllowedAdminWallets();
      const adminWallet = await getAdminSessionWallet(req);

      if (!adminWallet) {
        await auditLog("admin_launch_prepare_denied", { hasAdminCookie });
        return NextResponse.json(
          {
            error: hasAdminCookie
              ? "Admin session not found or expired. Try Admin Sign-In again."
              : "Admin Sign-In required",
          },
          { status: 401 }
        );
      }

      if (!allowed.has(adminWallet)) {
        await auditLog("admin_launch_prepare_denied", { adminWallet });
        return NextResponse.json({ error: "Not an allowed admin wallet" }, { status: 401 });
      }
    }

    const body = (await req.json().catch(() => null)) as any;

    const payerWallet = typeof body?.payerWallet === "string" ? body.payerWallet.trim() : "";
    const devBuySol = Number(body?.devBuySol ?? 0.01);

    if (!payerWallet) return NextResponse.json({ error: "payerWallet is required" }, { status: 400 });

    let payerPubkey: PublicKey;
    try {
      payerPubkey = new PublicKey(payerWallet);
    } catch {
      return NextResponse.json({ error: "Invalid payer wallet address" }, { status: 400 });
    }
    const { walletId, address: creatorWallet } = await privyCreateSolanaWallet();
    const creatorPubkey = new PublicKey(creatorWallet);

    const devBuyLamports = Math.floor(devBuySol * 1_000_000_000);
    const requiredLamports = devBuyLamports + 10_000_000;

    const connection = getConnection();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("processed");

    const tx = new Transaction();
    tx.feePayer = payerPubkey;
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.add(
      SystemProgram.transfer({
        fromPubkey: payerPubkey,
        toPubkey: creatorPubkey,
        lamports: requiredLamports,
      })
    );

    const txBytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const txBase64 = Buffer.from(Uint8Array.from(txBytes)).toString("base64");

    await auditLog("launch_prepare", {
      walletId,
      creatorWallet,
      payerWallet: payerPubkey.toBase58(),
      requiredLamports,
      devBuySol,
    });

    return NextResponse.json({
      ok: true,
      walletId,
      creatorWallet,
      payerWallet: payerPubkey.toBase58(),
      requiredLamports,
      txBase64,
      txFormat: "base64",
      txType: "fund_launch_wallet",
      blockhash,
      lastValidBlockHeight,
    });
  } catch (e) {
    await auditLog("launch_prepare_error", { error: getSafeErrorMessage(e) });
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}
