-- house-lights schema for Supabase
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query)

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ============================================================
-- Core data tables (populated by scrapers, public read-only)
-- ============================================================

create table venue (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  city         text not null default 'Amsterdam',
  website_url  text,
  scrape_url   text,
  scraper_key  text,
  priority     text not null default 'medium',
  active       boolean not null default true,
  address      text,
  neighbourhood text,
  venue_type   text,
  capacity     integer,
  description  text,
  image_url    text
);

create table company (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  website_url  text,
  scrape_url   text,
  scraper_key  text,
  priority     text not null default 'medium',
  active       boolean not null default true,
  description  text,
  image_url    text
);

create table show (
  id             uuid primary key default uuid_generate_v4(),
  title          text not null,
  subtitle       text,
  venue_id       uuid references venue(id) on delete set null,
  company_id     uuid references company(id) on delete set null,
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

create index show_date_idx on show(date);
create index show_source_id_idx on show(source_id);
create index show_venue_id_idx on show(venue_id);
create index show_company_id_idx on show(company_id);

-- ============================================================
-- User tables (auth + social)
-- ============================================================

create table profile (
  id            uuid primary key references auth.users on delete cascade,
  username      text unique not null,
  display_name  text,
  is_public     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table watchlist (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users not null,
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
  user_id    uuid references auth.users not null,
  friend_id  uuid references auth.users not null,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table venue     enable row level security;
alter table company   enable row level security;
alter table show      enable row level security;
alter table profile   enable row level security;
alter table watchlist enable row level security;
alter table friendship enable row level security;

-- venue / company / show: public read, service role write
create policy "public read venues"    on venue     for select using (true);
create policy "public read companies" on company   for select using (true);
create policy "public read shows"     on show      for select using (true);

-- profile: public read, own write
create policy "public read profiles"  on profile for select using (true);
create policy "own profile insert"    on profile for insert with check (auth.uid() = id);
create policy "own profile update"    on profile for update using (auth.uid() = id);

-- watchlist: own rows always; others' rows if their profile is public or you're friends
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

-- friendship: own rows
create policy "own friendships" on friendship
  for all using (auth.uid() = user_id);

create policy "read incoming friendships" on friendship
  for select using (auth.uid() = friend_id);

-- ============================================================
-- Helper: auto-create profile on signup
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
