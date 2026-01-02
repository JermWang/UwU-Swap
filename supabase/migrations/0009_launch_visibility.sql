-- Ensure schema matches app code paths used by Creator Dashboard + Discover + automated launches.
-- Safe to run multiple times.

-- Commitments: add creator_fee_mode used by managed/assisted creator fee flows.
alter table if exists public.commitments
  add column if not exists creator_fee_mode text null;

-- Helpful indexes for listing/filtering.
create index if not exists commitments_token_mint_idx on public.commitments(token_mint);
create index if not exists commitments_creator_pubkey_idx on public.commitments(creator_pubkey);
create index if not exists commitments_authority_idx on public.commitments(authority);
create index if not exists commitments_destination_on_fail_idx on public.commitments(destination_on_fail);

-- Project profiles: banner_url is used by the UI + API.
alter table if exists public.project_profiles
  add column if not exists banner_url text null;

-- Launch treasury wallet mapping (payer wallet -> persisted Privy walletId + treasury address).
create table if not exists public.launch_treasury_wallets (
  payer_wallet text primary key,
  wallet_id text not null,
  treasury_wallet text not null,
  created_at_unix bigint not null,
  updated_at_unix bigint not null
);

create index if not exists launch_treasury_wallets_updated_idx on public.launch_treasury_wallets(updated_at_unix);

-- Pump.fun creator fee claim locks (prevents concurrent fee claims per creator).
create table if not exists public.pumpfun_creator_fee_claim_locks (
  creator_pubkey text primary key,
  created_at_unix bigint not null,
  tx_sig text null
);

-- Match prod hardening: restrict direct client access.
revoke all on table
  public.launch_treasury_wallets,
  public.pumpfun_creator_fee_claim_locks
from anon, authenticated;
