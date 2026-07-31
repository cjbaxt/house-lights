-- migrate_004_waitlist_retention.sql
-- Run in Supabase SQL editor
-- Requires pg_cron extension (enabled by default on Supabase)

select cron.schedule(
  'delete-stale-waitlist',
  '0 3 * * 0',  -- weekly, Sunday at 3am UTC
  $$
    delete from beta_waitlist
    where created_at < now() - interval '12 months'
    and status = 'waiting';
  $$
);
