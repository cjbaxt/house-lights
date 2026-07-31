-- migrate_006_event_log.sql
-- Server-side analytics: ticket clicks, searches, watchlist events
-- GDPR notes:
--   - user_id is nullable (anonymous users tracked without PII)
--   - SET NULL on user delete (data retained but de-identified)
--   - 24-month retention via pg_cron
--   - No user-facing read access (admin only)

create table if not exists event_log (
  id          bigserial primary key,
  event_type  text        not null,  -- 'ticket_click' | 'search' | 'watchlist_add' | 'watchlist_remove'
  user_id     uuid        references auth.users(id) on delete set null,
  show_id     uuid        references show(id) on delete set null,
  venue_id    uuid        references venue(id) on delete set null,
  city_id     uuid        references city(id) on delete set null,
  metadata    jsonb,                 -- flexible: {query, filter_types, filter_timeframe, ...}
  created_at  timestamptz not null default now()
);

-- Analytics queries: clicks by venue over time, popular searches
create index if not exists event_log_type_date   on event_log (event_type, created_at desc);
create index if not exists event_log_show        on event_log (show_id) where show_id is not null;
create index if not exists event_log_venue       on event_log (venue_id) where venue_id is not null;
create index if not exists event_log_user        on event_log (user_id) where user_id is not null;

-- RLS: anyone can insert, no one can read (admin via service role only)
alter table event_log enable row level security;

create policy "insert event_log"
  on event_log for insert
  with check (true);

-- Purge events older than 24 months (weekly, Sunday 3:30am UTC)
select cron.schedule(
  'purge-old-events',
  '30 3 * * 0',
  $$
    delete from event_log
    where created_at < now() - interval '24 months';
  $$
);
