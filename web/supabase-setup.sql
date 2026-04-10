create table if not exists public.private_life_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.private_life_state enable row level security;

create policy "Allow anonymous read"
on public.private_life_state
for select
to anon
using (true);

create policy "Allow anonymous write"
on public.private_life_state
for insert
to anon
with check (true);

create policy "Allow anonymous update"
on public.private_life_state
for update
to anon
using (true)
with check (true);
