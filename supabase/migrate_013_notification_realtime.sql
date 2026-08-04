-- migrate_013_notification_realtime.sql
-- Enable Realtime on the notification table so the bell updates live.
alter publication supabase_realtime add table notification;
