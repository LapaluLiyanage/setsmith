-- Setsmith schema (Supabase / Postgres). Already applied to the hosted project as a migration;
-- keep this file in sync so a fresh project can be set up from it in the SQL editor.
--
-- Model: each band has one JSON document (client BandState: songs, shows, singers) plus an access
-- list with roles. Writes go through save_band_data(), which compares a revision number so two
-- editors can't silently overwrite each other.

create extension if not exists pgcrypto;

create type band_role as enum ('manager', 'editor', 'viewer');

create table bands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table band_access (
  band_id uuid not null references bands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role band_role not null,
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (band_id, user_id)
);
create index on band_access (user_id);

create table band_data (
  band_id uuid primary key references bands(id) on delete cascade,
  data jsonb not null,
  rev integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table invites (
  code text primary key default encode(gen_random_bytes(9), 'hex'),
  band_id uuid not null references bands(id) on delete cascade,
  role band_role not null default 'viewer' check (role <> 'manager'),
  -- A reusable invite (e.g. a group viewer link) is never marked used, so anyone with the link
  -- can redeem it, any number of times.
  reusable boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references auth.users(id),
  used_at timestamptz
);
create index on invites (band_id);
create unique index invites_reusable_slot on invites (band_id, role) where reusable;

-- Read-only public links, one per show. Served through get_shared(), never by table access.
create table shares (
  token text primary key default encode(gen_random_bytes(12), 'hex'),
  band_id uuid not null references bands(id) on delete cascade,
  show_id text not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (band_id, show_id)
);

-- Which setlist item Stage view is currently on, per band. Kept separate from band_data
-- so the coordinator's "next song" tap is instant, not gated behind the save debounce/rev check.
create table now_playing (
  band_id uuid primary key references bands(id) on delete cascade,
  show_id text not null,
  item_id text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table bands enable row level security;
alter table band_access enable row level security;
alter table band_data enable row level security;
alter table invites enable row level security;
alter table shares enable row level security;
alter table now_playing enable row level security;

create function my_role(b uuid) returns band_role
language sql stable security definer set search_path = public as $$
  select role from band_access where band_id = b and user_id = (select auth.uid())
$$;

create policy "members read band" on bands for select to authenticated
  using (my_role(id) is not null);

create policy "members read access list" on band_access for select to authenticated
  using (my_role(band_id) is not null);
create policy "manager changes roles" on band_access for update to authenticated
  using (my_role(band_id) = 'manager' and user_id <> (select auth.uid()))
  with check (my_role(band_id) = 'manager' and role <> 'manager');
create policy "manager removes members" on band_access for delete to authenticated
  using (my_role(band_id) = 'manager' and user_id <> (select auth.uid()));

create policy "members read band data" on band_data for select to authenticated
  using (my_role(band_id) is not null);

create policy "members read now playing" on now_playing for select to authenticated
  using (my_role(band_id) is not null);
-- Anyone with a show's public share link follows the live "now playing" pointer, no account needed.
create policy "public read now playing via share" on now_playing for select to anon
  using (exists (select 1 from shares s where s.band_id = now_playing.band_id and s.show_id = now_playing.show_id));

create policy "manager reads invites" on invites for select to authenticated
  using (my_role(band_id) = 'manager');
create policy "manager makes invites" on invites for insert to authenticated
  with check (my_role(band_id) = 'manager' and created_by = (select auth.uid()));
create policy "manager deletes invites" on invites for delete to authenticated
  using (my_role(band_id) = 'manager');

create policy "manager reads shares" on shares for select to authenticated
  using (my_role(band_id) = 'manager');
create policy "manager makes shares" on shares for insert to authenticated
  with check (my_role(band_id) = 'manager' and created_by = (select auth.uid()));
create policy "manager deletes shares" on shares for delete to authenticated
  using (my_role(band_id) = 'manager');

create function create_band(p_name text, p_data jsonb, p_display text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'create a real account to manage a band';
  end if;
  insert into bands (name, created_by) values (p_name, uid) returning id into new_id;
  insert into band_access (band_id, user_id, role, display_name) values (new_id, uid, 'manager', p_display);
  insert into band_data (band_id, data, updated_by) values (new_id, p_data, uid);
  return new_id;
end $$;

-- Returns the new revision, or -1 when someone else saved first (caller should reload).
create function save_band_data(p_band uuid, p_data jsonb, p_expected integer) returns integer
language plpgsql security definer set search_path = public as $$
declare
  new_rev integer;
begin
  if my_role(p_band) is null or my_role(p_band) = 'viewer' then
    raise exception 'not allowed';
  end if;
  update band_data
     set data = p_data, rev = rev + 1, updated_at = now(), updated_by = auth.uid()
   where band_id = p_band and rev = p_expected
   returning rev into new_rev;
  return coalesce(new_rev, -1);
end $$;

-- Sets one setlist item's note. Unlike save_band_data, viewers ARE allowed here -- it's the one
-- write scoped narrowly enough (just a text field, on one item, no reordering/BPM/key/song-list
-- access) to be safe to hand to a read-only band member from Stage view.
create function set_item_note(p_band uuid, p_item_id text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  d jsonb;
  next_data jsonb;
  found boolean := false;
  si int; ssi int; ii int;
begin
  if my_role(p_band) is null then raise exception 'not allowed'; end if;
  select data into d from band_data where band_id = p_band for update;
  if d is null then raise exception 'band not found'; end if;

  next_data := d;
  for si in 0 .. coalesce(jsonb_array_length(d->'shows'), 0) - 1 loop
    for ssi in 0 .. coalesce(jsonb_array_length(d->'shows'->si->'sessions'), 0) - 1 loop
      for ii in 0 .. coalesce(jsonb_array_length(d->'shows'->si->'sessions'->ssi->'items'), 0) - 1 loop
        if d->'shows'->si->'sessions'->ssi->'items'->ii->>'id' = p_item_id then
          next_data := jsonb_set(next_data,
            array['shows', si::text, 'sessions', ssi::text, 'items', ii::text, 'notes'],
            to_jsonb(p_note));
          found := true;
        end if;
      end loop;
    end loop;
  end loop;
  if not found then raise exception 'setlist item not found'; end if;

  update band_data set data = next_data, rev = rev + 1, updated_at = now(), updated_by = auth.uid()
   where band_id = p_band;
end $$;

-- Moves the shared "current song" pointer. Viewers can only read it (see the RLS policy above);
-- managers and editors drive it from Stage view.
create function set_now_playing(p_band uuid, p_show text, p_item text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_role(p_band) is null or my_role(p_band) = 'viewer' then
    raise exception 'not allowed';
  end if;
  insert into now_playing (band_id, show_id, item_id, updated_at, updated_by)
    values (p_band, p_show, p_item, now(), auth.uid())
  on conflict (band_id) do update
    set show_id = excluded.show_id, item_id = excluded.item_id, updated_at = now(), updated_by = auth.uid();
end $$;

create function accept_invite(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  inv invites%rowtype;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into inv from invites where code = p_code for update;
  if not found or (not inv.reusable and inv.used_by is not null) or inv.expires_at < now() then
    raise exception 'invite is invalid or expired';
  end if;
  insert into band_access (band_id, user_id, role)
    values (inv.band_id, uid, inv.role)
    on conflict (band_id, user_id) do nothing;
  if not inv.reusable then
    update invites set used_by = uid, used_at = now() where code = p_code;
  end if;
  return inv.band_id;
end $$;

create function set_display_name(p_band uuid, p_name text) returns void
language sql security definer set search_path = public as $$
  update band_access set display_name = left(p_name, 60)
   where band_id = p_band and user_id = auth.uid()
$$;

-- Public, read-only view of one shared show: only the songs it uses, and singers by name.
create function get_shared(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s shares%rowtype;
  d jsonb;
  b text;
  shw jsonb;
begin
  select * into s from shares where token = p_token;
  if not found then return null; end if;
  select data into d from band_data where band_id = s.band_id;
  select name into b from bands where id = s.band_id;
  select x into shw from jsonb_array_elements(d -> 'shows') x where x ->> 'id' = s.show_id limit 1;
  if shw is null then return null; end if;
  return jsonb_build_object(
    'bandId', s.band_id,
    'bandName', b,
    'show', shw,
    'songs', (
      select coalesce(jsonb_object_agg(k, d -> 'songs' -> k), '{}'::jsonb)
      from (
        select distinct i ->> 'songId' as k
        from jsonb_array_elements(shw -> 'sessions') se, jsonb_array_elements(se -> 'items') i
      ) used
      where d -> 'songs' ? k
    ),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object('id', m ->> 'id', 'name', m ->> 'name', 'isSinger', m -> 'isSinger')), '[]'::jsonb)
      from jsonb_array_elements(d -> 'members') m
    )
  );
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function my_role(uuid), create_band(text, jsonb, text), save_band_data(uuid, jsonb, integer),
  set_now_playing(uuid, text, text), set_item_note(uuid, text, text), accept_invite(text), set_display_name(uuid, text) to authenticated;
grant execute on function get_shared(text) to anon, authenticated;

alter publication supabase_realtime add table band_data, band_access, now_playing;
