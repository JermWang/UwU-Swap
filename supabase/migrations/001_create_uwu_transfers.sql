create table if not exists public.uwu_transfers (
  id uuid primary key,
  status text not null,
  version integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists uwu_transfers_status_idx on public.uwu_transfers(status);
create index if not exists uwu_transfers_updated_at_idx on public.uwu_transfers(updated_at);

create or replace function public.uwu_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists uwu_set_updated_at on public.uwu_transfers;
create trigger uwu_set_updated_at
before update on public.uwu_transfers
for each row execute function public.uwu_set_updated_at();
