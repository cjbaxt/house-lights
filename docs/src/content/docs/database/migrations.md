---
title: Running migrations
description: How database migrations work in house lights.
---

Migrations are plain SQL files in `supabase/`. They are **not run automatically** — you apply them manually in the Supabase SQL editor.

## Naming convention

```
migrate_NNN_short_description.sql
```

`NNN` is a zero-padded sequential number. Always use the next available number.

Examples:
- `migrate_009_drop_priority.sql`
- `migrate_010_share_ticket_status.sql`
- `migrate_011_invite_codes.sql`

## Applying a migration

1. Open the [Supabase SQL editor](https://supabase.com/dashboard)
2. Select the house lights project
3. Paste the migration SQL and run it
4. Commit the migration file to `dev` as part of the same PR that uses it

## `schema.sql`

`supabase/schema.sql` is a **reference copy** of the full schema. It is not applied automatically — update it manually to reflect the current DB state after running a migration.

## Writing a migration

Keep migrations idempotent where possible:

```sql
-- Good — safe to re-run
alter table venue add column if not exists image_url text;

-- Also good for table creation
create table if not exists new_table (...);

-- For inserts, use WHERE NOT EXISTS
insert into venue (name, scraper_key, ...)
select 'Venue Name', 'slug', ...
where not exists (select 1 from venue where scraper_key = 'slug');
```
