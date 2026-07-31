-- house-lights schema for Supabase
-- Run this in the Supabase SQL editor to set up a fresh project
-- For an existing project, use the migration files in this directory instead

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ============================================================
-- Cities
-- ============================================================

create table city (
  id        uuid primary key default uuid_generate_v4(),
  name      text not null,
  slug      text unique not null,
  country   text not null default 'NL',
  timezone  text not null default 'Europe/Amsterdam',
  is_active boolean not null default true
);

-- ============================================================
-- Core data tables (populated by scrapers, public read-only)
-- ============================================================

create table venue (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  city_id       uuid references city(id) not null,
  website_url   text,
  scrape_url    text,
  scraper_key   text,
  priority      text not null default 'medium',
  active        boolean not null default true,
  address       text,
  neighbourhood text,
  venue_type    text,
  capacity      integer,
  description   text,
  image_url     text
);

create table company (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  website_url text,
  scrape_url  text,
  scraper_key text,
  priority    text not null default 'medium',
  active      boolean not null default true,
  description text,
  image_url   text
);

create table show (
  id             uuid primary key default uuid_generate_v4(),
  title          text not null,
  subtitle       text,
  venue_id       uuid references venue(id) on delete set null,
  company_id     uuid references company(id) on delete set null,
  city_id        uuid references city(id),
  date           date not null,
  time           time,
  end_time       time,
  type           text,
  url            text,
  ticket_status  text,
  price_from     double precision,
  currency       text not null default 'EUR',
  description    text,
  summary        text,
  image_url      text,
  embedding      vector(1024),
  scraped_at     timestamptz not null default now(),
  source_id      text unique
);

create index show_date_idx      on show(date);
create index show_source_id_idx on show(source_id);
create index show_venue_id_idx  on show(venue_id);
create index show_company_id_idx on show(company_id);
create index show_city_id_idx   on show(city_id);
create index venue_city_id_idx  on venue(city_id);

-- ============================================================
-- User tables
-- ============================================================

create table profile (
  id           uuid primary key references auth.users on delete cascade,
  username     text unique not null,
  display_name text,
  avatar_url   text,
  is_public    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table user_preferences (
  user_id              uuid primary key references profile(id) on delete cascade,
  default_city_id      uuid references city(id),
  hide_duplicate_shows boolean not null default true,
  created_at           timestamptz not null default now()
);

create table user_city (
  user_id  uuid references auth.users(id) on delete cascade not null,
  city_id  uuid references city(id) on delete cascade not null,
  primary key (user_id, city_id)
);

create table watchlist (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  show_id    uuid references show(id) on delete cascade not null,
  status     text not null default 'interested',
  notes      text,
  added_at   timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, show_id)
);

create index watchlist_user_id_idx on watchlist(user_id);
create index watchlist_show_id_idx on watchlist(show_id);

create table friendship (
  user_id    uuid references auth.users(id) on delete cascade not null,
  friend_id  uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table city           enable row level security;
alter table venue          enable row level security;
alter table company        enable row level security;
alter table show           enable row level security;
alter table profile        enable row level security;
alter table user_preferences enable row level security;
alter table user_city      enable row level security;
alter table watchlist      enable row level security;
alter table friendship     enable row level security;

-- public read
create policy "public read cities"    on city     for select using (true);
create policy "public read venues"    on venue    for select using (true);
create policy "public read companies" on company  for select using (true);
create policy "public read shows"     on show     for select using (true);

-- profile: public read, own write
create policy "public read profiles" on profile for select using (true);
create policy "own profile insert"   on profile for insert with check (auth.uid() = id);
create policy "own profile update"   on profile for update using (auth.uid() = id);

-- user_preferences: strictly private
create policy "own preferences all" on user_preferences
  for all using (auth.uid() = user_id);

-- user_city: own rows only
create policy "own city prefs" on user_city
  for all using (auth.uid() = user_id);

-- watchlist
create policy "own watchlist all" on watchlist
  for all using (auth.uid() = user_id);

create policy "read public watchlists" on watchlist
  for select using (
    exists (
      select 1 from profile
      where profile.id = watchlist.user_id
        and profile.is_public = true
    )
  );

create policy "read friends watchlists" on watchlist
  for select using (
    exists (
      select 1 from friendship
      where friendship.user_id = auth.uid()
        and friendship.friend_id = watchlist.user_id
    )
  );

-- friendship
create policy "own friendships" on friendship
  for all using (auth.uid() = user_id);

create policy "read incoming friendships" on friendship
  for select using (auth.uid() = friend_id);

-- ============================================================
-- Seed data
-- ============================================================

insert into city (name, slug, country, timezone, is_active) values
  ('Amsterdam', 'amsterdam', 'NL', 'Europe/Amsterdam', true),
  ('Utrecht',   'utrecht',   'NL', 'Europe/Amsterdam', false),
  ('Rotterdam', 'rotterdam', 'NL', 'Europe/Amsterdam', false),
  ('Brussels',  'brussels',  'BE', 'Europe/Brussels',  false),
  ('Ghent',     'ghent',     'BE', 'Europe/Brussels',  false),
  ('Antwerp',   'antwerp',   'BE', 'Europe/Brussels',  false);

-- ============================================================
-- Helper: auto-create profile + preferences + city on signup
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
