-- Setsmith schema (Supabase / Postgres). Apply in the Supabase SQL editor.
-- Mirrors client/src/lib/types.ts. Not wired into the app yet: the client saves to
-- localStorage until the Supabase milestone (see README roadmap).

create extension if not exists pgcrypto;

create table bands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create type band_role as enum ('manager', 'editor', 'viewer');

-- A person in the band. user_id is null until they accept an invite and sign in,
-- so the manager can list singers before everyone has an account.
create table members (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  user_id uuid references auth.users(id),
  name text not null,
  email text,
  role band_role not null default 'viewer',
  is_singer boolean not null default false,
  key_low text,   -- comfortable range for transpose suggestions, e.g. 'A2'
  key_high text,
  unique (band_id, user_id)
);

create type bpm_source as enum ('lookup', 'analysis', 'tap', 'manual');

-- The band's song library: BPM/key are looked up once and reused across shows.
create table songs (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  title text not null,
  artist text not null default '',
  youtube_id text check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  duration_sec integer not null default 0,
  bpm smallint check (bpm between 30 and 300),
  key_tonic smallint check (key_tonic between 0 and 11),
  key_mode text check (key_mode in ('major', 'minor')),
  bpm_source bpm_source,
  language text,
  created_at timestamptz not null default now()
);

create table shows (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  name text not null,
  show_date date,
  venue text not null default '',
  slot_minutes integer not null default 120,
  -- Read-only public link; null means sharing is off.
  share_token text unique,
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references shows(id) on delete cascade,
  name text not null,
  position integer not null,
  target_minutes integer not null default 45
);

create table setlist_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  song_id uuid not null references songs(id) on delete restrict,
  singer_id uuid references members(id) on delete set null,
  position integer not null,
  transpose smallint not null default 0 check (transpose between -11 and 11),
  notes text not null default ''
);

create index on members (band_id);
create index on songs (band_id);
create index on shows (band_id);
create index on sessions (show_id, position);
create index on setlist_items (session_id, position);

-- Row-level security: members can read their band; managers/editors can write.
alter table bands enable row level security;
alter table members enable row level security;
alter table songs enable row level security;
alter table shows enable row level security;
alter table sessions enable row level security;
alter table setlist_items enable row level security;

create function band_role_of(b uuid) returns band_role
language sql stable security definer set search_path = public as $$
  select role from members where band_id = b and user_id = auth.uid()
$$;

create policy "members read band" on bands for select using (band_role_of(id) is not null);
create policy "creator makes band" on bands for insert with check (created_by = auth.uid());

create policy "read members" on members for select using (band_role_of(band_id) is not null);
create policy "manager edits members" on members for all
  using (band_role_of(band_id) = 'manager') with check (band_role_of(band_id) = 'manager');

create policy "read songs" on songs for select using (band_role_of(band_id) is not null);
create policy "edit songs" on songs for all
  using (band_role_of(band_id) in ('manager', 'editor')) with check (band_role_of(band_id) in ('manager', 'editor'));

create policy "read shows" on shows for select using (band_role_of(band_id) is not null);
create policy "manager edits shows" on shows for all
  using (band_role_of(band_id) = 'manager') with check (band_role_of(band_id) = 'manager');

create policy "read sessions" on sessions for select
  using (band_role_of((select band_id from shows where id = show_id)) is not null);
create policy "edit sessions" on sessions for all
  using (band_role_of((select band_id from shows where id = show_id)) in ('manager', 'editor'))
  with check (band_role_of((select band_id from shows where id = show_id)) in ('manager', 'editor'));

create policy "read items" on setlist_items for select
  using (band_role_of((select sh.band_id from sessions se join shows sh on sh.id = se.show_id where se.id = session_id)) is not null);
create policy "edit items" on setlist_items for all
  using (band_role_of((select sh.band_id from sessions se join shows sh on sh.id = se.show_id where se.id = session_id)) in ('manager', 'editor'))
  with check (band_role_of((select sh.band_id from sessions se join shows sh on sh.id = se.show_id where se.id = session_id)) in ('manager', 'editor'));

-- Public share links are served by the API with the service role, looked up by share_token,
-- so no anonymous policy is needed here.
