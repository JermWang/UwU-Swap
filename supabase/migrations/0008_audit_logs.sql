create table if not exists public.audit_logs (
  id bigserial primary key,
  ts_unix bigint not null,
  event text not null,
  fields jsonb not null default '{}'::jsonb
);

create index if not exists audit_logs_ts_idx on public.audit_logs(ts_unix);
create index if not exists audit_logs_event_idx on public.audit_logs(event);

revoke all on table public.audit_logs from anon, authenticated;
