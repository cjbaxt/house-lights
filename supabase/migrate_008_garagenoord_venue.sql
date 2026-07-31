-- migrate_008_garagenoord_venue.sql
-- Add Garage Noord venue so the scraper can attach shows to it.

do $$
declare
  _city_id uuid;
begin
  select id into _city_id from city where slug = 'amsterdam' limit 1;

  insert into venue (name, scraper_key, website_url, priority, active, city_id)
  values (
    'Garage Noord',
    'garagenoord',
    'https://www.garagenoord.com',
    'medium',
    true,
    _city_id
  )
  on conflict (scraper_key) do update
    set name        = excluded.name,
        website_url = excluded.website_url,
        active      = true;
end $$;
