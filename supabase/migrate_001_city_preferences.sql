-- Migration 001: city table, user_preferences, cascade fixes, avatar_url
-- Run in Supabase SQL editor or via psql

-- ============================================================
-- 1. City table
-- ============================================================

create table if not exists city (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text unique not null,
  country     text not null default 'NL',
  timezone    text not null default 'Europe/Amsterdam',
  is_active   boolean not null default true
);

alter table city enable row level security;
create policy "public read cities" on city for select using (true);

insert into city (name, slug, country, timezone, is_active) values
  ('Amsterdam', 'amsterdam', 'NL', 'Europe/Amsterdam', true),
  ('Utrecht',   'utrecht',   'NL', 'Europe/Amsterdam', false),
  ('Rotterdam', 'rotterdam', 'NL', 'Europe/Amsterdam', false),
  ('Brussels',  'brussels',  'BE', 'Europe/Brussels',  false),
  ('Ghent',     'ghent',     'BE', 'Europe/Brussels',  false),
  ('Antwerp',   'antwerp',   'BE', 'Europe/Brussels',  false)
on conflict (slug) do nothing;

-- ============================================================
-- 2. venue: replace city text with city_id FK
-- ============================================================

alter table venue add column if not exists city_id uuid references city(id);

update venue
set city_id = (select id from city where slug = 'amsterdam')
where city_id is null;

alter table venue alter column city_id set not null;
alter table venue drop column if exists city;

create index if not exists venue_city_id_idx on venue(city_id);

-- ============================================================
-- 3. show: add denormalized city_id
-- ============================================================

alter table show add column if not exists city_id uuid references city(id);

-- backfill from venue
update show
set city_id = (select city_id from venue where venue.id = show.venue_id)
where venue_id is not null and city_id is null;

-- company-only shows: default to amsterdam
update show
set city_id = (select id from city where slug = 'amsterdam')
where city_id is null;

create index if not exists show_city_id_idx on show(city_id);

-- ============================================================
-- 4. user_preferences table
-- ============================================================

create table if not exists user_preferences (
  user_id              uuid primary key references profile(id) on delete cascade,
  default_city_id      uuid references city(id),
  hide_duplicate_shows boolean not null default true,
  created_at           timestamptz not null default now()
);

alter table user_preferences enable row level security;
create policy "own preferences all" on user_preferences
  for all using (auth.uid() = user_id);

-- migrate existing hide_duplicate_shows values from profile
insert into user_preferences (user_id, hide_duplicate_shows)
select id, coalesce(hide_duplicate_shows, true)
from profile
on conflict (user_id) do nothing;

alter table profile drop column if exists hide_duplicate_shows;

-- ============================================================
-- 5. user_city table
-- ============================================================

create table if not exists user_city (
  user_id  uuid references auth.users(id) on delete cascade not null,
  city_id  uuid references city(id) on delete cascade not null,
  primary key (user_id, city_id)
);

alter table user_city enable row level security;
create policy "own city prefs" on user_city for all using (auth.uid() = user_id);

-- default: give existing users amsterdam
insert into user_city (user_id, city_id)
select au.id, c.id
from auth.users au
cross join city c
where c.slug = 'amsterdam'
on conflict do nothing;

-- ============================================================
-- 6. avatar_url on profile
-- ============================================================

alter table profile add column if not exists avatar_url text;

-- ============================================================
-- 7. Fix cascade deletes on watchlist and friendship
-- ============================================================

alter table watchlist drop constraint if exists watchlist_user_id_fkey;
alter table watchlist
  add constraint watchlist_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table friendship drop constraint if exists friendship_user_id_fkey;
alter table friendship drop constraint if exists friendship_friend_id_fkey;
alter table friendship
  add constraint friendship_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table friendship
  add constraint friendship_friend_id_fkey
  foreign key (friend_id) references auth.users(id) on delete cascade;

-- ============================================================
-- 8. Update handle_new_user trigger
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  amsterdam_id uuid;
begin
  select id into amsterdam_id from city where slug = 'amsterdam';

  insert into public.profile (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );

  insert into public.user_preferences (user_id)
  values (new.id);

  insert into public.user_city (user_id, city_id)
  values (new.id, amsterdam_id);

  return new;
end;
$$;
