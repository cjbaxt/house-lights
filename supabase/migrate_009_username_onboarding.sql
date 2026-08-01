-- HL-71: Force username + display name selection at signup
-- Add username_confirmed flag; change trigger to use UUID placeholder

ALTER TABLE profile ADD COLUMN IF NOT EXISTS username_confirmed boolean NOT NULL DEFAULT false;

-- Existing users with real (non-UUID) usernames are considered confirmed
UPDATE profile SET username_confirmed = true WHERE username != id::text;

-- Update trigger: use UUID as placeholder, display_name null, confirmed false
CREATE OR REPLACE FUNCTION handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  amsterdam_id uuid;
begin
  select id into amsterdam_id from city where slug = 'amsterdam';

  insert into public.profile (id, username, display_name, username_confirmed)
  values (new.id, new.id::text, null, false);

  insert into public.user_preferences (user_id)
  values (new.id);

  if amsterdam_id is not null then
    insert into public.user_city (user_id, city_id)
    values (new.id, amsterdam_id);
  end if;

  return new;
end;
$$;
