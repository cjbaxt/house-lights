-- migrate_012_invite_code_tracking.sql
-- Tracks which invite code each user signed up with, enabling
-- the admin page to list all users per multi-use code.

alter table profile
  add column if not exists invite_code_id uuid references invite_code(id) on delete set null;

create index if not exists profile_invite_code_id_idx on profile(invite_code_id);
