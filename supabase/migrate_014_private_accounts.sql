-- Migration 014: private accounts + follow approval
--
-- 1. Add status column to friendship (pending | accepted)
-- 2. Default profile.is_public to false (new users private by default)
-- 3. Update RLS policies on friendship to respect status

-- Add status to friendship
alter table friendship
  add column if not exists status text not null default 'accepted'
  check (status in ('pending', 'accepted'));

-- Existing rows are all accepted
update friendship set status = 'accepted' where status != 'accepted';

-- Unique constraint for pending requests (already have PK on user_id, friend_id)
-- No change needed — the PK prevents duplicate requests

-- New users default to private
alter table profile alter column is_public set default false;

-- RLS: viewers should only see accepted friendships (not pending ones from others)
-- Drop and recreate friendship policies

drop policy if exists "Users can view their own friendships" on friendship;
drop policy if exists "Users can insert their own friendships" on friendship;
drop policy if exists "Users can delete their own friendships" on friendship;
drop policy if exists "Users can update their own friendships" on friendship;

-- A user can see a friendship row if:
--   - they are the follower (user_id) — see all their own outgoing follows/requests
--   - they are the followed (friend_id) — see all incoming follows/requests
--   - the friendship is accepted and they are viewing someone else's public follow graph
create policy "Users can view relevant friendships"
  on friendship for select
  using (
    user_id = auth.uid()
    or friend_id = auth.uid()
  );

create policy "Users can insert friendships"
  on friendship for insert
  with check (user_id = auth.uid());

create policy "Users can delete their own friendships"
  on friendship for delete
  using (user_id = auth.uid());

-- Allow the followed user to accept/reject (update status)
create policy "Users can update incoming friendships"
  on friendship for update
  using (friend_id = auth.uid());
