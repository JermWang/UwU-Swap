import crypto from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

import { getPool, hasDatabase } from "./db";

export type CommitmentKind = "personal" | "creator_reward";

export type CommitmentStatus =
  | "created"
  | "resolving"
  | "resolved_success"
  | "resolved_failure"
  | "active"
  | "completed"
  | "failed";

export type RewardMilestoneStatus = "locked" | "claimable" | "released";

export type RewardMilestone = {
  id: string;
  title: string;
  unlockLamports: number;
  status: RewardMilestoneStatus;
  completedAtUnix?: number;
  claimableAtUnix?: number;
  becameClaimableAtUnix?: number;
  releasedAtUnix?: number;
  releasedTxSig?: string;
};

export type CommitmentRecord = {
  id: string;
  statement?: string;
  authority: string;
  destinationOnFail: string;
  amountLamports: number;
  deadlineUnix: number;
  escrowPubkey: string;
  escrowSecretKey: string;
  kind: CommitmentKind;
  creatorPubkey?: string;
  tokenMint?: string;
  totalFundedLamports: number;
  unlockedLamports: number;
  milestones?: RewardMilestone[];
  status: CommitmentStatus;
  createdAtUnix: number;
  resolvedAtUnix?: number;
  resolvedTxSig?: string;
};

export type RewardMilestoneApprovalCounts = Record<string, number>;

type InMemoryRewardSignals = Map<string, Map<string, Set<string>>>;

const mem = {
  commitments: new Map<string, CommitmentRecord>(),
  rewardSignals: new Map<string, Map<string, Set<string>>>() as InMemoryRewardSignals,
};

function ensureMockSeeded(): void {
  if (hasDatabase()) return;
  if (mem.commitments.size > 0) return;

  const now = nowUnix();

  const makeSig = () => bs58.encode(new Uint8Array(crypto.randomBytes(64)));
  const makeKeypair = () => Keypair.generate();

  const makeCommitmentKeypair = () => {
    const escrow = makeKeypair();
    return {
      escrowPubkey: escrow.publicKey.toBase58(),
      escrowSecretKeyB58: bs58.encode(escrow.secretKey),
    };
  };

  const makeWallet = () => makeKeypair().publicKey.toBase58();

  const personal1 = (() => {
    const { escrowPubkey, escrowSecretKeyB58 } = makeCommitmentKeypair();
    const authority = makeWallet();
    const destinationOnFail = makeWallet();
    const id = crypto.randomBytes(16).toString("hex");
    const createdAtUnix = now - 36 * 60 * 60;
    return {
      ...createCommitmentRecord({
        id,
        statement: "Ship v1 onboarding + landing polish",
        authority,
        destinationOnFail,
        amountLamports: Math.floor(0.5 * 1_000_000_000),
        deadlineUnix: now + 3 * 24 * 60 * 60,
        escrowPubkey,
        escrowSecretKeyB58,
      }),
      createdAtUnix,
      status: "created" as const,
    } satisfies CommitmentRecord;
  })();

  const personal2 = (() => {
    const { escrowPubkey, escrowSecretKeyB58 } = makeCommitmentKeypair();
    const authority = makeWallet();
    const destinationOnFail = makeWallet();
    const id = crypto.randomBytes(16).toString("hex");
    const createdAtUnix = now - 6 * 24 * 60 * 60;
    const resolvedAtUnix = now - 4 * 60 * 60;
    return {
      ...createCommitmentRecord({
        id,
        statement: "Publish audit report + fix P0 bugs",
        authority,
        destinationOnFail,
        amountLamports: Math.floor(1.25 * 1_000_000_000),
        deadlineUnix: now + 24 * 60 * 60,
        escrowPubkey,
        escrowSecretKeyB58,
      }),
      createdAtUnix,
      status: "resolved_success" as const,
      resolvedAtUnix,
      resolvedTxSig: makeSig(),
    } satisfies CommitmentRecord;
  })();

  const personal3 = (() => {
    const { escrowPubkey, escrowSecretKeyB58 } = makeCommitmentKeypair();
    const authority = makeWallet();
    const destinationOnFail = makeWallet();
    const id = crypto.randomBytes(16).toString("hex");
    const createdAtUnix = now - 12 * 24 * 60 * 60;
    const deadlineUnix = now - 3 * 24 * 60 * 60;
    const resolvedAtUnix = now - 2 * 24 * 60 * 60;
    return {
      ...createCommitmentRecord({
        id,
        statement: "Open-source core escrow contracts",
        authority,
        destinationOnFail,
        amountLamports: Math.floor(0.75 * 1_000_000_000),
        deadlineUnix,
        escrowPubkey,
        escrowSecretKeyB58,
      }),
      createdAtUnix,
      deadlineUnix,
      status: "resolved_failure" as const,
      resolvedAtUnix,
      resolvedTxSig: makeSig(),
    } satisfies CommitmentRecord;
  })();

  const reward1 = (() => {
    const { escrowPubkey, escrowSecretKeyB58 } = makeCommitmentKeypair();
    const creatorPubkey = makeWallet();
    const tokenMint = makeWallet();
    const id = crypto.randomBytes(16).toString("hex");
    const createdAtUnix = now - 10 * 24 * 60 * 60;

    const m1Id = crypto.randomBytes(8).toString("hex");
    const m2Id = crypto.randomBytes(8).toString("hex");
    const m3Id = crypto.randomBytes(8).toString("hex");
    const m4Id = crypto.randomBytes(8).toString("hex");

    const base = createRewardCommitmentRecord({
      id,
      statement: "Weekly dev-fee unlocks for shipping v2",
      creatorPubkey,
      escrowPubkey,
      escrowSecretKeyB58,
      tokenMint,
      milestones: [
        { id: m1Id, title: "Ship v2 alpha build", unlockLamports: Math.floor(1.0 * 1_000_000_000) },
        { id: m2Id, title: "Ship v2 beta + docs", unlockLamports: Math.floor(1.5 * 1_000_000_000) },
        { id: m3Id, title: "Public mainnet release", unlockLamports: Math.floor(2.0 * 1_000_000_000) },
        { id: m4Id, title: "Post-launch stability week", unlockLamports: Math.floor(0.75 * 1_000_000_000) },
      ],
    });

    const milestones = base.milestones;
    if (!milestones || milestones.length < 4) {
      throw new Error("Invalid seed reward commitment (missing milestones)");
    }

    const m1 = milestones[0];
    const m2 = milestones[1];
    const m3 = milestones[2];
    const m4 = milestones[3];

    const m1Completed = now - 8 * 24 * 60 * 60;
    const m1Claimable = m1Completed + 48 * 60 * 60;
    const m1Released = now - 6 * 24 * 60 * 60;

    const m2Completed = now - 4 * 24 * 60 * 60;
    const m2Claimable = m2Completed + 48 * 60 * 60;
    const m2BecameClaimable = now - 2 * 24 * 60 * 60;

    const m3Completed = now - 12 * 60 * 60;
    const m3Claimable = m3Completed + 48 * 60 * 60;

    const m4Completed = null;

    return {
      ...base,
      createdAtUnix,
      status: "active" as const,
      totalFundedLamports: Math.floor(5.25 * 1_000_000_000),
      unlockedLamports: Math.floor(2.5 * 1_000_000_000),
      milestones: [
        {
          ...m1,
          status: "released" as const,
          completedAtUnix: m1Completed,
          claimableAtUnix: m1Claimable,
          becameClaimableAtUnix: m1Claimable,
          releasedAtUnix: m1Released,
          releasedTxSig: makeSig(),
        },
        {
          ...m2,
          status: "claimable" as const,
          completedAtUnix: m2Completed,
          claimableAtUnix: m2Claimable,
          becameClaimableAtUnix: m2BecameClaimable,
        },
        {
          ...m3,
          status: "locked" as const,
          completedAtUnix: m3Completed,
          claimableAtUnix: m3Claimable,
        },
        {
          ...m4,
          status: "locked" as const,
          completedAtUnix: m4Completed ?? undefined,
          claimableAtUnix: undefined,
        },
      ],
    } satisfies CommitmentRecord;
  })();

  const reward2 = (() => {
    const { escrowPubkey, escrowSecretKeyB58 } = makeCommitmentKeypair();
    const creatorPubkey = makeWallet();
    const tokenMint = makeWallet();
    const id = crypto.randomBytes(16).toString("hex");
    const createdAtUnix = now - 22 * 24 * 60 * 60;
    const releasedAtUnix = now - 7 * 24 * 60 * 60;

    const base = createRewardCommitmentRecord({
      id,
      statement: "Milestone rewards for shipping creator tools",
      creatorPubkey,
      escrowPubkey,
      escrowSecretKeyB58,
      tokenMint,
      milestones: [
        { id: crypto.randomBytes(8).toString("hex"), title: "Ship creator dashboard", unlockLamports: Math.floor(3 * 1_000_000_000) },
        { id: crypto.randomBytes(8).toString("hex"), title: "Ship analytics + alerts", unlockLamports: Math.floor(4 * 1_000_000_000) },
        { id: crypto.randomBytes(8).toString("hex"), title: "Ship gasless voting UX", unlockLamports: Math.floor(3 * 1_000_000_000) },
      ],
    });

    return {
      ...base,
      createdAtUnix,
      status: "completed" as const,
      totalFundedLamports: Math.floor(10 * 1_000_000_000),
      unlockedLamports: Math.floor(10 * 1_000_000_000),
      milestones: (base.milestones ?? []).map((m, idx) => {
        const completedAtUnix = releasedAtUnix - (idx + 2) * 24 * 60 * 60;
        const claimableAtUnix = completedAtUnix + 48 * 60 * 60;
        return {
          ...m,
          status: "released" as const,
          completedAtUnix,
          claimableAtUnix,
          becameClaimableAtUnix: claimableAtUnix,
          releasedAtUnix: releasedAtUnix - idx * 12 * 60 * 60,
          releasedTxSig: makeSig(),
        };
      }),
    } satisfies CommitmentRecord;
  })();

  const reward3 = (() => {
    const { escrowPubkey, escrowSecretKeyB58 } = makeCommitmentKeypair();
    const creatorPubkey = makeWallet();
    const tokenMint = makeWallet();
    const id = crypto.randomBytes(16).toString("hex");
    const createdAtUnix = now - 2 * 24 * 60 * 60;

    const base = createRewardCommitmentRecord({
      id,
      statement: "Dev-fee escrow for the next 30 days",
      creatorPubkey,
      escrowPubkey,
      escrowSecretKeyB58,
      tokenMint,
      milestones: [
        { id: crypto.randomBytes(8).toString("hex"), title: "Ship patch release", unlockLamports: Math.floor(0.4 * 1_000_000_000) },
        { id: crypto.randomBytes(8).toString("hex"), title: "Ship marketing push", unlockLamports: Math.floor(0.6 * 1_000_000_000) },
      ],
    });

    return {
      ...base,
      createdAtUnix,
      status: "active" as const,
      totalFundedLamports: Math.floor(1.1 * 1_000_000_000),
      unlockedLamports: 0,
    } satisfies CommitmentRecord;
  })();

  for (const c of [personal1, reward1, personal2, reward3, personal3, reward2]) {
    mem.commitments.set(c.id, c);
  }

  const seedSignals = (commitmentId: string, milestoneId: string, count: number) => {
    let byMilestone = mem.rewardSignals.get(commitmentId);
    if (!byMilestone) {
      byMilestone = new Map();
      mem.rewardSignals.set(commitmentId, byMilestone);
    }
    let signers = byMilestone.get(milestoneId);
    if (!signers) {
      signers = new Set();
      byMilestone.set(milestoneId, signers);
    }
    while (signers.size < count) {
      signers.add(makeKeypair().publicKey.toBase58());
    }
  };

  const r1 = reward1;
  const r1Milestones = r1.milestones ?? [];
  if (r1Milestones[0]) seedSignals(r1.id, r1Milestones[0].id, 11);
  if (r1Milestones[1]) seedSignals(r1.id, r1Milestones[1].id, 7);
  if (r1Milestones[2]) seedSignals(r1.id, r1Milestones[2].id, 2);
}

function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

function sha256Bytes(input: string): Uint8Array {
  const h = crypto.createHash("sha256");
  h.update(input, "utf8");
  return new Uint8Array(h.digest());
}

function encryptSecret(plainB58: string): string {
  const secret = process.env.ESCROW_DB_SECRET;
  if (!secret) return plainB58;

  const key = sha256Bytes(secret);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const msg = new TextEncoder().encode(plainB58);
  const box = nacl.secretbox(msg, nonce, key);

  const packed = new Uint8Array(nonce.length + box.length);
  packed.set(nonce, 0);
  packed.set(box, nonce.length);
  return `enc:${Buffer.from(packed).toString("base64")}`;
}

function decryptSecret(stored: string): string {
  if (!stored.startsWith("enc:")) return stored;

  const secret = process.env.ESCROW_DB_SECRET;
  if (!secret) throw new Error("ESCROW_DB_SECRET is required to decrypt escrow secrets");

  const key = sha256Bytes(secret);
  const packed = Buffer.from(stored.slice("enc:".length), "base64");
  const nonce = new Uint8Array(packed.subarray(0, nacl.secretbox.nonceLength));
  const box = new Uint8Array(packed.subarray(nacl.secretbox.nonceLength));
  const opened = nacl.secretbox.open(box, nonce, key);
  if (!opened) throw new Error("Failed to decrypt escrow secret");
  return new TextDecoder().decode(opened);
}

async function ensureSchema(): Promise<void> {
  if (!hasDatabase()) return;
  const pool = getPool();
  await pool.query(`
    create table if not exists commitments (
      id text primary key,
      statement text null,
      authority text not null,
      destination_on_fail text not null,
      amount_lamports bigint not null,
      deadline_unix bigint not null,
      escrow_pubkey text not null,
      escrow_secret_key text not null,
      kind text not null default 'personal',
      creator_pubkey text null,
      token_mint text null,
      total_funded_lamports bigint not null default 0,
      unlocked_lamports bigint not null default 0,
      milestones_json text null,
      status text not null,
      created_at_unix bigint not null,
      resolved_at_unix bigint null,
      resolved_tx_sig text null
    );
    create index if not exists commitments_status_idx on commitments(status);
    create index if not exists commitments_deadline_idx on commitments(deadline_unix);
    create index if not exists commitments_kind_idx on commitments(kind);
  `);

  await pool.query(`alter table commitments add column if not exists statement text null;`);
  await pool.query(`alter table commitments add column if not exists kind text not null default 'personal';`);
  await pool.query(`alter table commitments add column if not exists creator_pubkey text null;`);
  await pool.query(`alter table commitments add column if not exists token_mint text null;`);
  await pool.query(`alter table commitments add column if not exists total_funded_lamports bigint not null default 0;`);
  await pool.query(`alter table commitments add column if not exists unlocked_lamports bigint not null default 0;`);
  await pool.query(`alter table commitments add column if not exists milestones_json text null;`);

  await pool.query(`
    create table if not exists reward_milestone_signals (
      commitment_id text not null,
      milestone_id text not null,
      signer_pubkey text not null,
      created_at_unix bigint not null,
      primary key (commitment_id, milestone_id, signer_pubkey)
    );
    create index if not exists reward_milestone_signals_commitment_idx on reward_milestone_signals(commitment_id);
    create index if not exists reward_milestone_signals_milestone_idx on reward_milestone_signals(commitment_id, milestone_id);
  `);
}

function parseMilestonesJson(raw: any): RewardMilestone[] | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t.length) return undefined;
  try {
    const parsed = JSON.parse(t);
    if (!Array.isArray(parsed)) return undefined;
    return parsed as RewardMilestone[];
  } catch {
    return undefined;
  }
}

function rowToRecord(row: any): CommitmentRecord {
  return {
    id: row.id,
    statement: row.statement ?? undefined,
    authority: row.authority,
    destinationOnFail: row.destination_on_fail,
    amountLamports: Number(row.amount_lamports),
    deadlineUnix: Number(row.deadline_unix),
    escrowPubkey: row.escrow_pubkey,
    escrowSecretKey: row.escrow_secret_key,
    kind: (row.kind ?? "personal") as CommitmentKind,
    creatorPubkey: row.creator_pubkey ?? undefined,
    tokenMint: row.token_mint ?? undefined,
    totalFundedLamports: Number(row.total_funded_lamports ?? 0),
    unlockedLamports: Number(row.unlocked_lamports ?? 0),
    milestones: parseMilestonesJson(row.milestones_json),
    status: row.status,
    createdAtUnix: Number(row.created_at_unix),
    resolvedAtUnix: row.resolved_at_unix == null ? undefined : Number(row.resolved_at_unix),
    resolvedTxSig: row.resolved_tx_sig ?? undefined,
  };
}

export function createCommitmentRecord(input: {
  id: string;
  statement?: string;
  authority: string;
  destinationOnFail: string;
  amountLamports: number;
  deadlineUnix: number;
  escrowPubkey: string;
  escrowSecretKeyB58: string;
}): CommitmentRecord {
  return {
    id: input.id,
    statement: input.statement,
    authority: input.authority,
    destinationOnFail: input.destinationOnFail,
    amountLamports: input.amountLamports,
    deadlineUnix: input.deadlineUnix,
    escrowPubkey: input.escrowPubkey,
    escrowSecretKey: encryptSecret(input.escrowSecretKeyB58),
    kind: "personal",
    creatorPubkey: undefined,
    totalFundedLamports: 0,
    unlockedLamports: 0,
    milestones: undefined,
    status: "created",
    createdAtUnix: nowUnix(),
  };
}

export function createRewardCommitmentRecord(input: {
  id: string;
  statement?: string;
  creatorPubkey: string;
  escrowPubkey: string;
  escrowSecretKeyB58: string;
  milestones: Array<{ id: string; title: string; unlockLamports: number }>;
  tokenMint?: string;
}): CommitmentRecord {
  return {
    id: input.id,
    statement: input.statement,
    authority: input.creatorPubkey,
    destinationOnFail: input.creatorPubkey,
    amountLamports: 0,
    deadlineUnix: nowUnix(),
    escrowPubkey: input.escrowPubkey,
    escrowSecretKey: encryptSecret(input.escrowSecretKeyB58),
    kind: "creator_reward",
    creatorPubkey: input.creatorPubkey,
    tokenMint: input.tokenMint,
    totalFundedLamports: 0,
    unlockedLamports: 0,
    milestones: input.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      unlockLamports: m.unlockLamports,
      status: "locked" as const,
    })),
    status: "active",
    createdAtUnix: nowUnix(),
  };
}

export function publicView(r: CommitmentRecord): Omit<CommitmentRecord, "escrowSecretKey"> {
  const { escrowSecretKey: _ignored, ...rest } = r;
  return rest;
}

export function getEscrowSecretKeyB58(r: CommitmentRecord): string {
  return decryptSecret(r.escrowSecretKey);
}

export async function insertCommitment(r: CommitmentRecord): Promise<void> {
  await ensureSchema();

  if (!hasDatabase()) {
    mem.commitments.set(r.id, r);
    return;
  }

  const pool = getPool();
  await pool.query(
    `insert into commitments (
      id, statement, authority, destination_on_fail, amount_lamports, deadline_unix,
      escrow_pubkey, escrow_secret_key,
      kind, creator_pubkey, token_mint, total_funded_lamports, unlocked_lamports, milestones_json,
      status, created_at_unix, resolved_at_unix, resolved_tx_sig
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [
      r.id,
      r.statement ?? null,
      r.authority,
      r.destinationOnFail,
      String(r.amountLamports),
      String(r.deadlineUnix),
      r.escrowPubkey,
      r.escrowSecretKey,
      r.kind,
      r.creatorPubkey ?? null,
      r.tokenMint ?? null,
      String(r.totalFundedLamports ?? 0),
      String(r.unlockedLamports ?? 0),
      r.milestones ? JSON.stringify(r.milestones) : null,
      r.status,
      String(r.createdAtUnix),
      r.resolvedAtUnix == null ? null : String(r.resolvedAtUnix),
      r.resolvedTxSig ?? null,
    ]
  );
}

export function sumReleasedLamports(milestones: RewardMilestone[] | undefined): number {
  if (!milestones || milestones.length === 0) return 0;
  return milestones.reduce((acc, m) => (m.status === "released" ? acc + Number(m.unlockLamports || 0) : acc), 0);
}

export async function upsertRewardMilestoneSignal(input: {
  commitmentId: string;
  milestoneId: string;
  signerPubkey: string;
  createdAtUnix: number;
}): Promise<{ inserted: boolean }> {
  await ensureSchema();

  ensureMockSeeded();

  if (!hasDatabase()) {
    let byMilestone = mem.rewardSignals.get(input.commitmentId);
    if (!byMilestone) {
      byMilestone = new Map();
      mem.rewardSignals.set(input.commitmentId, byMilestone);
    }
    let signers = byMilestone.get(input.milestoneId);
    if (!signers) {
      signers = new Set();
      byMilestone.set(input.milestoneId, signers);
    }
    const before = signers.size;
    signers.add(input.signerPubkey);
    return { inserted: signers.size !== before };
  }

  const pool = getPool();
  const res = await pool.query(
    `insert into reward_milestone_signals (commitment_id, milestone_id, signer_pubkey, created_at_unix)
     values ($1,$2,$3,$4)
     on conflict (commitment_id, milestone_id, signer_pubkey) do nothing
     returning commitment_id`,
    [input.commitmentId, input.milestoneId, input.signerPubkey, String(input.createdAtUnix)]
  );
  return { inserted: Boolean(res.rows[0]) };
}

export async function getRewardMilestoneApprovalCounts(commitmentId: string): Promise<RewardMilestoneApprovalCounts> {
  await ensureSchema();

  ensureMockSeeded();

  if (!hasDatabase()) {
    const out: RewardMilestoneApprovalCounts = {};
    const byMilestone = mem.rewardSignals.get(commitmentId);
    if (!byMilestone) return out;
    for (const [milestoneId, signers] of byMilestone.entries()) {
      out[milestoneId] = signers.size;
    }
    return out;
  }

  const pool = getPool();
  const res = await pool.query(
    "select milestone_id, count(*)::int as c from reward_milestone_signals where commitment_id=$1 group by milestone_id",
    [commitmentId]
  );
  const out: RewardMilestoneApprovalCounts = {};
  for (const row of res.rows) {
    out[String(row.milestone_id)] = Number(row.c ?? 0);
  }
  return out;
}

export function getRewardApprovalThreshold(): number {
  const raw = Number(process.env.REWARD_APPROVAL_THRESHOLD ?? "");
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return 3;
}

export function normalizeRewardMilestonesClaimable(input: {
  milestones: RewardMilestone[];
  nowUnix: number;
  approvalCounts: RewardMilestoneApprovalCounts;
  approvalThreshold: number;
}): { milestones: RewardMilestone[]; changed: boolean } {
  const { milestones, nowUnix, approvalCounts, approvalThreshold } = input;
  let changed = false;
  const next = milestones.map((m) => {
    if (m.status === "claimable" && m.becameClaimableAtUnix == null) {
      changed = true;
      return {
        ...m,
        becameClaimableAtUnix: m.claimableAtUnix ?? nowUnix,
      };
    }
    if (m.status !== "locked") return m;
    if (m.completedAtUnix == null) return m;
    if (m.claimableAtUnix == null) return m;
    if (nowUnix < m.claimableAtUnix) return m;

    const approvals = Number(approvalCounts[m.id] ?? 0);
    if (approvals < approvalThreshold) return m;

    changed = true;
    return {
      ...m,
      status: "claimable" as const,
      becameClaimableAtUnix: m.becameClaimableAtUnix ?? nowUnix,
    };
  });
  return { milestones: next, changed };
}

export async function updateRewardTotalsAndMilestones(input: {
  id: string;
  totalFundedLamports?: number;
  unlockedLamports?: number;
  milestones?: RewardMilestone[];
  status?: CommitmentStatus;
}): Promise<CommitmentRecord> {
  await ensureSchema();

  if (!hasDatabase()) {
    const current = mem.commitments.get(input.id);
    if (!current) throw new Error("Not found");
    const updated: CommitmentRecord = {
      ...current,
      totalFundedLamports: input.totalFundedLamports ?? current.totalFundedLamports,
      unlockedLamports: input.unlockedLamports ?? current.unlockedLamports,
      milestones: input.milestones ?? current.milestones,
      status: input.status ?? current.status,
    };
    mem.commitments.set(input.id, updated);
    return updated;
  }

  const pool = getPool();

  const fields: string[] = [];
  const values: any[] = [input.id];
  let idx = 2;

  if (input.totalFundedLamports != null) {
    fields.push(`total_funded_lamports=$${idx++}`);
    values.push(String(input.totalFundedLamports));
  }
  if (input.unlockedLamports != null) {
    fields.push(`unlocked_lamports=$${idx++}`);
    values.push(String(input.unlockedLamports));
  }
  if (input.milestones != null) {
    fields.push(`milestones_json=$${idx++}`);
    values.push(JSON.stringify(input.milestones));
  }
  if (input.status != null) {
    fields.push(`status=$${idx++}`);
    values.push(input.status);
  }

  if (fields.length === 0) {
    const current = await getCommitment(input.id);
    if (!current) throw new Error("Not found");
    return current;
  }

  const res = await pool.query(`update commitments set ${fields.join(", ")} where id=$1 returning *`, values);
  const row = res.rows[0];
  if (!row) throw new Error("Not found");
  return rowToRecord(row);
}

export async function listCommitments(): Promise<CommitmentRecord[]> {
  await ensureSchema();

  ensureMockSeeded();

  if (!hasDatabase()) {
    return Array.from(mem.commitments.values()).sort((a, b) => b.createdAtUnix - a.createdAtUnix);
  }

  const pool = getPool();
  const res = await pool.query("select * from commitments order by created_at_unix desc");
  return res.rows.map(rowToRecord);
}

export async function getCommitment(id: string): Promise<CommitmentRecord | null> {
  await ensureSchema();

  ensureMockSeeded();

  if (!hasDatabase()) {
    return mem.commitments.get(id) ?? null;
  }

  const pool = getPool();
  const res = await pool.query("select * from commitments where id=$1", [id]);
  const row = res.rows[0];
  return row ? rowToRecord(row) : null;
}

export async function claimForResolution(id: string): Promise<CommitmentRecord | null> {
  await ensureSchema();

  if (!hasDatabase()) {
    const current = mem.commitments.get(id);
    if (!current) return null;
    if (current.status !== "created") return null;
    const next: CommitmentRecord = { ...current, status: "resolving" };
    mem.commitments.set(id, next);
    return next;
  }

  const pool = getPool();
  const res = await pool.query(
    "update commitments set status='resolving' where id=$1 and status='created' returning *",
    [id]
  );
  const row = res.rows[0];
  return row ? rowToRecord(row) : null;
}

export async function finalizeResolution(input: {
  id: string;
  status: "resolved_success" | "resolved_failure";
  resolvedAtUnix: number;
  resolvedTxSig: string;
}): Promise<CommitmentRecord> {
  await ensureSchema();

  if (!hasDatabase()) {
    const current = mem.commitments.get(input.id);
    if (!current || current.status !== "resolving") throw new Error("Commitment not in resolving state");
    const next: CommitmentRecord = {
      ...current,
      status: input.status,
      resolvedAtUnix: input.resolvedAtUnix,
      resolvedTxSig: input.resolvedTxSig,
    };
    mem.commitments.set(input.id, next);
    return next;
  }

  const pool = getPool();
  const res = await pool.query(
    "update commitments set status=$2, resolved_at_unix=$3, resolved_tx_sig=$4 where id=$1 and status='resolving' returning *",
    [input.id, input.status, String(input.resolvedAtUnix), input.resolvedTxSig]
  );
  const row = res.rows[0];
  if (!row) throw new Error("Commitment not in resolving state");
  return rowToRecord(row);
}

export async function releaseResolutionClaim(id: string): Promise<void> {
  await ensureSchema();

  if (!hasDatabase()) {
    const current = mem.commitments.get(id);
    if (current && current.status === "resolving") {
      mem.commitments.set(id, { ...current, status: "created" });
    }
    return;
  }

  const pool = getPool();
  await pool.query("update commitments set status='created' where id=$1 and status='resolving'", [id]);
}

export function randomId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function validateEscrowSecretKeyB58(secret: string): void {
  const bytes = bs58.decode(secret);
  if (bytes.length !== 64) {
    throw new Error("Invalid escrow secret key length");
  }
}
