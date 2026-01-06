import { NextResponse } from "next/server";
import { Keypair, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

import { auditLog } from "../../../lib/auditLog";
import { checkRateLimit } from "../../../lib/rateLimit";
import { getSafeErrorMessage } from "../../../lib/safeError";
import {
  getChainUnixTime,
  getConnection,
  keypairFromBase58Secret,
  transferSplTokensFromKeypair,
  transferSplTokensFromPrivyWallet,
} from "../../../lib/solana";
import { getPool, hasDatabase } from "../../../lib/db";

export const runtime = "nodejs";

function isVoteRewardPayoutsEnabled(): boolean {
  const raw = String(process.env.CTS_ENABLE_VOTE_REWARD_PAYOUTS ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function expectedClaimAllGlobalMessage(input: { walletPubkey: string; timestampUnix: number }): string {
  return `Commit To Ship\nVote Reward Claim All Global\nWallet: ${input.walletPubkey}\nTimestamp: ${input.timestampUnix}`;
}

function isFreshEnough(nowUnix: number, timestampUnix: number): boolean {
  const skew = Math.abs(nowUnix - timestampUnix);
  return skew <= 5 * 60;
}

function getFaucetSigner(input: { faucetOwnerPubkey: PublicKey }): { kind: "privy"; walletId: string; owner: PublicKey } | { kind: "keypair"; keypair: Keypair } {
  const privyWalletId = String(process.env.CTS_VOTE_REWARD_FAUCET_PRIVY_WALLET_ID ?? "").trim();
  if (privyWalletId) {
    return { kind: "privy", walletId: privyWalletId, owner: input.faucetOwnerPubkey };
  }

  const secret = String(process.env.CTS_VOTE_REWARD_FAUCET_OWNER_SECRET_KEY ?? "").trim();
  if (!secret) {
    throw new Error("CTS_VOTE_REWARD_FAUCET_OWNER_SECRET_KEY (or CTS_VOTE_REWARD_FAUCET_PRIVY_WALLET_ID) is required");
  }

  const kp = keypairFromBase58Secret(secret);
  if (!kp.publicKey.equals(input.faucetOwnerPubkey)) {
    throw new Error("Faucet owner secret key does not match CTS_VOTE_REWARD_FAUCET_OWNER_PUBKEY");
  }

  return { kind: "keypair", keypair: kp };
}

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(req, { keyPrefix: "vote-reward:claim-all-global", limit: 10, windowSeconds: 60 });
    if (!rl.allowed) {
      const res = NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
      res.headers.set("retry-after", String(rl.retryAfterSeconds));
      return res;
    }

    if (!isVoteRewardPayoutsEnabled()) {
      return NextResponse.json(
        {
          error: "Vote reward payouts are disabled",
          hint: "Set CTS_ENABLE_VOTE_REWARD_PAYOUTS=1 (or true) to enable vote reward claims.",
        },
        { status: 503 }
      );
    }

    if (!hasDatabase()) {
      return NextResponse.json({ error: "Database is required for claim-all-global" }, { status: 503 });
    }

    const body = (await req.json().catch(() => null)) as any;

    const walletPubkey = typeof body?.walletPubkey === "string" ? body.walletPubkey.trim() : "";
    const timestampUnix = Number(body?.timestampUnix);
    const signatureB58 = typeof body?.signatureB58 === "string" ? body.signatureB58.trim() : "";

    if (!walletPubkey) return NextResponse.json({ error: "walletPubkey required" }, { status: 400 });
    if (!Number.isFinite(timestampUnix) || timestampUnix <= 0) return NextResponse.json({ error: "timestampUnix required" }, { status: 400 });
    if (!signatureB58) return NextResponse.json({ error: "signatureB58 required" }, { status: 400 });

    const connection = getConnection();
    const nowUnix = await getChainUnixTime(connection);
    if (!isFreshEnough(nowUnix, timestampUnix)) {
      return NextResponse.json({ error: "Signature timestamp is too old" }, { status: 400 });
    }

    const pk = new PublicKey(walletPubkey);
    const sigBytes = bs58.decode(signatureB58);
    const message = expectedClaimAllGlobalMessage({ walletPubkey, timestampUnix });

    const ok = nacl.sign.detached.verify(new TextEncoder().encode(message), sigBytes, pk.toBytes());
    if (!ok) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

    const pool = getPool();
    const client = await pool.connect();

    let insertedDistributionIds: string[] = [];
    let totalAmountRaw = 0n;
    let mintPubkey = "";
    let tokenProgramPubkey = "";
    let faucetOwnerPubkey = "";

    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [`vote_reward_claim_all_global:${walletPubkey}`]);

      const res = await client.query(
        `select
          d.id as distribution_id,
          d.commitment_id,
          d.milestone_id,
          d.mint_pubkey,
          d.token_program_pubkey,
          d.faucet_owner_pubkey,
          a.amount_raw::text as alloc_amount_raw,
          c.claimed_at_unix,
          c.tx_sig
         from vote_reward_distribution_allocations a
         join vote_reward_distributions d on d.id=a.distribution_id
         left join vote_reward_distribution_claims c
           on c.distribution_id=a.distribution_id and c.wallet_pubkey=a.wallet_pubkey
         where a.wallet_pubkey=$1
         order by d.created_at_unix asc, d.id asc`,
        [walletPubkey]
      );

      const pending = (res.rows ?? []).filter((r: any) => {
        const claimedAt = r?.claimed_at_unix;
        const txSig = String(r?.tx_sig ?? "");
        return claimedAt != null && !txSig.trim().length;
      });

      if (pending.length) {
        await client.query("rollback");
        return NextResponse.json(
          {
            error: "Found pending vote reward claims",
            pending: pending.map((r: any) => ({
              distributionId: String(r.distribution_id),
              commitmentId: String(r.commitment_id),
              milestoneId: String(r.milestone_id),
              amountRaw: String(r.alloc_amount_raw),
              claimedAtUnix: Number(r.claimed_at_unix),
            })),
          },
          { status: 409 }
        );
      }

      const claimable = (res.rows ?? []).filter((r: any) => r?.claimed_at_unix == null);
      if (!claimable.length) {
        await client.query("commit");
        return NextResponse.json({ ok: true, nowUnix, claimed: 0, amountRaw: "0", transfers: [] });
      }

      mintPubkey = String(claimable[0]?.mint_pubkey ?? "");
      tokenProgramPubkey = String(claimable[0]?.token_program_pubkey ?? "");
      faucetOwnerPubkey = String(claimable[0]?.faucet_owner_pubkey ?? "");

      for (const r of claimable) {
        let amt = 0n;
        try {
          amt = BigInt(String(r?.alloc_amount_raw ?? "0"));
        } catch {
          amt = 0n;
        }
        if (amt <= 0n) continue;

        const inserted = await client.query(
          `insert into vote_reward_distribution_claims (distribution_id, wallet_pubkey, claimed_at_unix, amount_raw, tx_sig)
           values ($1,$2,$3,$4,'')
           on conflict (distribution_id, wallet_pubkey) do nothing
           returning distribution_id`,
          [String(r.distribution_id), walletPubkey, String(nowUnix), String(amt)]
        );

        if (!inserted.rows?.[0]) continue;

        insertedDistributionIds.push(String(r.distribution_id));

        const mintPubkeyRow = String(r?.mint_pubkey ?? "");
        const tokenProgramPubkeyRow = String(r?.token_program_pubkey ?? "");
        const faucetOwnerPubkeyRow = String(r?.faucet_owner_pubkey ?? "");

        if (mintPubkeyRow !== mintPubkey) throw new Error("Multiple mints in claim-all-global result");
        if (tokenProgramPubkeyRow !== tokenProgramPubkey) throw new Error("Multiple token programs in claim-all-global result");
        if (faucetOwnerPubkeyRow !== faucetOwnerPubkey) throw new Error("Multiple faucet owners in claim-all-global result");
        totalAmountRaw += amt;
      }

      if (totalAmountRaw <= 0n || insertedDistributionIds.length === 0) {
        await client.query("rollback");
        return NextResponse.json({ error: "No claimable amount" }, { status: 400 });
      }

      await client.query("commit");
    } catch (e) {
      try {
        await client.query("rollback");
      } catch {
      }
      throw e;
    } finally {
      client.release();
    }

    const faucetOwner = new PublicKey(faucetOwnerPubkey);
    const signer = getFaucetSigner({ faucetOwnerPubkey: faucetOwner });

    const mint = new PublicKey(mintPubkey);
    const tokenProgram = new PublicKey(tokenProgramPubkey);

    const sent =
      signer.kind === "privy"
        ? await transferSplTokensFromPrivyWallet({
            connection,
            mint,
            walletId: signer.walletId,
            fromOwner: signer.owner,
            toOwner: pk,
            amountRaw: totalAmountRaw,
            tokenProgram,
          })
        : await transferSplTokensFromKeypair({
            connection,
            mint,
            from: signer.keypair,
            toOwner: pk,
            amountRaw: totalAmountRaw,
            tokenProgram,
          });

    const pool2 = getPool();
    await pool2.query(
      `update vote_reward_distribution_claims
       set tx_sig=$3
       where wallet_pubkey=$1
         and distribution_id = any($2::text[])
         and (tx_sig is null or tx_sig='')`,
      [walletPubkey, insertedDistributionIds, sent.signature]
    );

    const transfers: Array<{ mintPubkey: string; amountRaw: string; signature: string; distributions: number }> = [
      { mintPubkey, amountRaw: totalAmountRaw.toString(), signature: sent.signature, distributions: insertedDistributionIds.length },
    ];

    await auditLog("vote_reward_claim_all_global_ok", {
      walletPubkey,
      groups: 1,
      distributions: insertedDistributionIds.length,
      amountRaw: totalAmountRaw.toString(),
      signatures: [sent.signature],
    });

    return NextResponse.json({
      ok: true,
      nowUnix,
      walletPubkey,
      amountRaw: totalAmountRaw.toString(),
      transfers,
    });
  } catch (e) {
    await auditLog("vote_reward_claim_all_global_error", {
      error: getSafeErrorMessage(e),
    });
    return NextResponse.json({ error: getSafeErrorMessage(e) }, { status: 500 });
  }
}
