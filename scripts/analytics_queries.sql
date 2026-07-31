-- analytics_queries.sql
-- Run these in the Supabase SQL editor (service role / admin access required).
-- event_log table is insert-only for users; reads are admin-only.

-- -----------------------------------------------------------------------
-- TICKET CLICKS
-- -----------------------------------------------------------------------

-- Top clicked shows this month
select
  s.title,
  v.name as venue,
  count(*) as clicks
from event_log e
join show s on s.id = e.show_id
join venue v on v.id = e.venue_id
where e.event_type = 'ticket_click'
  and e.created_at > now() - interval '30 days'
group by s.title, v.name
order by clicks desc
limit 20;

-- Clicks per venue this month (useful for venue partnership pitches)
select
  v.name as venue,
  count(*) as clicks,
  count(distinct e.user_id) as unique_users
from event_log e
join venue v on v.id = e.venue_id
where e.event_type = 'ticket_click'
  and e.created_at > now() - interval '30 days'
group by v.name
order by clicks desc;

-- Click volume over time (daily, last 90 days)
select
  date_trunc('day', created_at)::date as day,
  count(*) as clicks
from event_log
where event_type = 'ticket_click'
  and created_at > now() - interval '90 days'
group by day
order by day;

-- Logged-in vs anonymous click split
select
  case when user_id is null then 'anonymous' else 'logged_in' end as user_type,
  count(*) as clicks
from event_log
where event_type = 'ticket_click'
  and created_at > now() - interval '30 days'
group by user_type;

-- -----------------------------------------------------------------------
-- SEARCH QUERIES (gap analysis — what are people looking for?)
-- -----------------------------------------------------------------------

-- Most searched terms (last 30 days)
select
  metadata->>'query' as query,
  count(*) as searches
from event_log
where event_type = 'search'
  and created_at > now() - interval '30 days'
group by query
order by searches desc
limit 50;

-- Searches with no matching shows (requires joining show titles — approximate)
-- Use this to find venues/artists worth adding scrapers for
select
  metadata->>'query' as query,
  count(*) as searches
from event_log
where event_type = 'search'
  and created_at > now() - interval '90 days'
  and not exists (
    select 1 from show
    where lower(title) like '%' || lower(metadata->>'query') || '%'
  )
group by query
order by searches desc
limit 30;

-- -----------------------------------------------------------------------
-- WATCHLIST EVENTS
-- -----------------------------------------------------------------------

-- Most watchlisted shows (last 30 days)
select
  s.title,
  v.name as venue,
  count(*) as adds
from event_log e
join show s on s.id = e.show_id
left join venue v on v.id = e.venue_id
where e.event_type = 'watchlist_add'
  and e.created_at > now() - interval '30 days'
group by s.title, v.name
order by adds desc
limit 20;

-- -----------------------------------------------------------------------
-- ENGAGEMENT OVERVIEW
-- -----------------------------------------------------------------------

-- Overall event breakdown (last 30 days)
select
  event_type,
  count(*) as total,
  count(distinct user_id) as unique_users
from event_log
where created_at > now() - interval '30 days'
group by event_type
order by total desc;
