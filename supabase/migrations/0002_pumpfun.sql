create extension if not exists pgcrypto;

create table if not exists public.creator_revenue_escrows (
  creator_pubkey text primary key,
  escrow_pubkey text not null,
  escrow_secret_key text not null,
  created_at_unix bigint not null
);

create table if not exists public.pumpfun_fee_sources (
  id uuid primary key default gen_random_uuid(),
  token_mint text not null,
  creator_pubkey text not null,
  authority_pubkey text not null,
  authority_secret_key text not null,
  enabled boolean not null default true,
  min_usd_to_sweep double precision not null default 0,
  min_interval_seconds integer not null default 3600,
  last_sweep_at_unix bigint null,
  last_sweep_sig text null,
  last_error text null,
  created_at_unix bigint not null,
  unique (token_mint)
);

create index if not exists pumpfun_fee_sources_creator_idx on public.pumpfun_fee_sources(creator_pubkey);
create index if not exists pumpfun_fee_sources_enabled_idx on public.pumpfun_fee_sources(enabled);

create table if not exists public.pumpfun_sweep_locks (
  source_id uuid primary key,
  created_at_unix bigint not null,
  tx_sig text null
);

create table if not exists public.pumpfun_fee_sweeps (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  token_mint text not null,
  started_at_unix bigint not null,
  completed_at_unix bigint null,
  claim_tx_sig text null,
  deposit_tx_sig text null,
  amount_lamports bigint null,
  amount_usd double precision null,
  status text not null,
  error text null
);

create index if not exists pumpfun_fee_sweeps_source_started_idx on public.pumpfun_fee_sweeps(source_id, started_at_unix);
create index if not exists pumpfun_fee_sweeps_status_idx on public.pumpfun_fee_sweeps(status);

alter table public.pumpfun_fee_sweeps
  add constraint pumpfun_fee_sweeps_source_fk
  foreign key (source_id) references public.pumpfun_fee_sources(id) on delete cascade;
