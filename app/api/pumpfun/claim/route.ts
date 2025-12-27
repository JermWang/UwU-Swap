import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

import { isAdminRequestAsync } from "../../../lib/adminAuth";
import { verifyAdminOrigin } from "../../../lib/adminSession";
import { getChainUnixTime, getConnection } from "../../../lib/solana";
import { claimCreatorFees, getClaimableCreatorFeeLamports } from "../../../lib/pumpfun";
import { releasePumpfunCreatorFeeClaimLock, tryAcquirePumpfunCreatorFeeClaimLock } from "../../../lib/pumpfunClaimLock";
import { getSafeErrorMessage } from "../../../lib/safeError";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    verifyAdminOrigin(req);
    if (!(await isAdminRequestAsync(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as any;
    const creatorPubkeyRaw = typeof body?.creatorPubkey === "string" ? body.creatorPubkey.trim() : "";

    if (!creatorPubkeyRaw) {
      return NextResponse.json({ error: "creatorPubkey is required" }, { status: 400 });
    }

    const creator = new PublicKey(creatorPubkeyRaw);
    const creatorPubkey = creator.toBase58();

    const lock = await tryAcquirePumpfunCreatorFeeClaimLock({ creatorPubkey, maxAgeSeconds: 90 });
    if (!lock.acquired) {
      return NextResponse.json({
        error: "Claim already in progress",
        creator: creatorPubkey,
        createdAtUnix: lock.existing.createdAtUnix,
      }, { status: 409 });
    }

    try {
      const connection = getConnection();
      const nowUnix = await getChainUnixTime(connection);

      const before = await getClaimableCreatorFeeLamports({ connection, creator });
      if (before.claimableLamports <= 0) {
        return NextResponse.json({
          error: "No claimable creator fees",
          nowUnix,
          creator: creatorPubkey,
          creatorVault: before.creatorVault.toBase58(),
          claimableLamports: before.claimableLamports,
        }, { status: 409 });
      }

      const { signature, claimableLamports, creatorVault } = await claimCreatorFees({ connection, creator });

      const after = await getClaimableCreatorFeeLamports({ connection, creator });

      return NextResponse.json({
        ok: true,
        nowUnix,
        signature,
        creator: creatorPubkey,
        creatorVault: creatorVault.toBase58(),
        claimableLamports,
        before: {
          creatorVault: before.creatorVault.toBase58(),
          vaultBalanceLamports: before.vaultBalanceLamports,
          rentExemptMinLamports: before.rentExemptMinLamports,
          claimableLamports: before.claimableLamports,
        },
        after: {
          creatorVault: after.creatorVault.toBase58(),
          vaultBalanceLamports: after.vaultBalanceLamports,
          rentExemptMinLamports: after.rentExemptMinLamports,
          claimableLamports: after.claimableLamports,
        },
      });
    } finally {
      await releasePumpfunCreatorFeeClaimLock({ creatorPubkey });
    }
  } catch (e) {
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}
