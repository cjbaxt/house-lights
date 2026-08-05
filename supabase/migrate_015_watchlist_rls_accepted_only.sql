-- Migration 015: restrict watchlist friend-read policy to accepted friendships only
--
-- The previous policy allowed any pending follower to read a private account's
-- watchlist via RLS. This fixes it to require status = 'accepted'.

drop policy if exists "read friends watchlists" on watchlist;

create policy "read friends watchlists" on watchlist
  for select using (
    exists (
      select 1 from friendship
      where friendship.user_id = auth.uid()
        and friendship.friend_id = watchlist.user_id
        and friendship.status = 'accepted'
    )
  );
