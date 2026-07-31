-- migrate_005_user_venues.sql
-- Run in Supabase SQL editor
-- Stores per-user venue visibility preferences

create table if not exists user_venue (
  user_id   uuid references auth.users(id) on delete cascade not null,
  venue_id  uuid references venue(id) on delete cascade not null,
  hidden    boolean not null default false,
  primary key (user_id, venue_id)
);

alter table user_venue enable row level security;

create policy "own user_venue all" on user_venue
  for all using (auth.uid() = user_id);
