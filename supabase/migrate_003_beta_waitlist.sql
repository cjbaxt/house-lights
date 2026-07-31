-- migrate_003_beta_waitlist.sql
-- Run in Supabase SQL editor

create table if not exists beta_waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text,
  created_at  timestamptz not null default now(),
  status      text not null default 'waiting' -- waiting | invited | registered
);

-- Only service role can read/write (no public access)
alter table beta_waitlist enable row level security;
