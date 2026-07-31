-- migrate_007_mezrab_venue.sql
-- Add Mezrab venue so the scraper can attach shows to it.
-- Run in Supabase SQL editor.

do $$
declare
  _city_id uuid;
begin
  select id into _city_id from city where slug = 'amsterdam' limit 1;

  insert into venue (name, scraper_key, website_url, priority, active, city_id)
  values (
    'Mezrab',
    'mezrab',
    'https://mezrab.nl',
    'medium',
    true,
    _city_id
  )
  on conflict (scraper_key) do update
    set name        = excluded.name,
        website_url = excluded.website_url,
        active      = true;
end $$;
