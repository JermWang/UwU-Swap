create table if not exists public.rate_limits (
  key text not null,
  window_start_unix bigint not null,
  count integer not null,
  reset_at_unix bigint not null,
  updated_at_unix bigint not null,
  primary key (key, window_start_unix)
);

create index if not exists rate_limits_reset_idx on public.rate_limits(reset_at_unix);

revoke all on table public.rate_limits from anon, authenticated;
