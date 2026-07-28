create extension if not exists "pgcrypto";

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  first_opened_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.invites(id) on delete cascade,
  guest_name text not null check (char_length(guest_name) between 1 and 80),
  attending boolean not null,
  auto_declined boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.responses add column if not exists auto_declined boolean not null default false;

create unique index if not exists responses_invite_id_unique on public.responses(invite_id);

alter table public.invites enable row level security;
alter table public.responses enable row level security;

drop policy if exists "public can read own invite by token" on public.invites;
create policy "public can read own invite by token"
  on public.invites
  for select
  to anon
  using (true);

drop policy if exists "public can update invite first open" on public.invites;
create policy "public can update invite first open"
  on public.invites
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "public can insert invite" on public.invites;
create policy "public can insert invite"
  on public.invites
  for insert
  to anon
  with check (true);

drop policy if exists "public can read response" on public.responses;
create policy "public can read response"
  on public.responses
  for select
  to anon
  using (true);

drop policy if exists "public can insert response" on public.responses;
create policy "public can insert response"
  on public.responses
  for insert
  to anon
  with check (true);
