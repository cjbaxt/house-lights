-- migrate_011_invite_codes.sql
-- Run in Supabase SQL editor

create table if not exists invite_code (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  created_at timestamptz not null default now(),
  used_by    uuid references auth.users(id) on delete set null,
  used_at    timestamptz,
  note       text  -- optional label e.g. "for alice", "batch jan 2026"
);

-- Only service role can write; no public read
alter table invite_code enable row level security;

-- Generate a handful of starter codes (replace with real values or generate via admin UI)
-- insert into invite_code (code) values ('HL-XXXX'), ('HL-YYYY');
