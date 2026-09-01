create table if not exists public.private_life_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete
  on public.private_life_state
  to authenticated;

alter table public.private_life_state enable row level security;

create policy "authenticated_read"
  on public.private_life_state
  for select to authenticated
  using (auth.role() = 'authenticated');

create policy "authenticated_insert"
  on public.private_life_state
  for insert to authenticated
  with check (auth.role() = 'authenticated');

create policy "authenticated_update"
  on public.private_life_state
  for update to authenticated
  using (auth.role() = 'authenticated');

create policy "authenticated_delete"
  on public.private_life_state
  for delete to authenticated
  using (auth.role() = 'authenticated');
