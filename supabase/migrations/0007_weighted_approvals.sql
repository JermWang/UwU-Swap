alter table if exists public.reward_voter_snapshots
  add column if not exists project_price_usd double precision not null default 0;

alter table if exists public.reward_voter_snapshots
  add column if not exists project_value_usd double precision not null default 0;

alter table if exists public.reward_milestone_signals
  add column if not exists project_price_usd double precision not null default 0;

alter table if exists public.reward_milestone_signals
  add column if not exists project_value_usd double precision not null default 0;

create index if not exists reward_voter_snapshots_milestone_idx
  on public.reward_voter_snapshots(commitment_id, milestone_id);

create index if not exists reward_milestone_signals_milestone_idx
  on public.reward_milestone_signals(commitment_id, milestone_id);
