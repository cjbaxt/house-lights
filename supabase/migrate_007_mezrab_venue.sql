-- migrate_007_mezrab_venue.sql
-- Add Mezrab venue so the scraper can attach shows to it.
-- Run in Supabase SQL editor.

do $$
declare
  _city_id uuid;
begin
  select id into _city_id from city where slug = 'amsterdam' limit 1;

  insert into venue (name, scraper_key, website_url, active, city_id)
  select 'Mezrab', 'mezrab', 'https://mezrab.nl', true, _city_id
  where not exists (select 1 from venue where scraper_key = 'mezrab');
end $$;
