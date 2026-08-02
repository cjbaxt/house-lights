-- migrate_009_drop_priority.sql
-- Remove priority column from venue and company tables.
-- Priority grouping has been removed from the UI.
-- Run in Supabase SQL editor.

alter table venue drop column if exists priority;
alter table company drop column if exists priority;
