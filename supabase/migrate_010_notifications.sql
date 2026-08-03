create table notification (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profile(id) on delete cascade,
  actor_id   uuid not null references profile(id) on delete cascade,
  type       text not null check (type in ('follow')),
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index notification_user_id_idx on notification(user_id, read, created_at desc);
-- Prevent duplicate follow notifications from the same actor
create unique index notification_follow_unique on notification(user_id, actor_id, type);

alter table notification enable row level security;

-- Users can only read their own notifications
create policy "Users can read own notifications"
  on notification for select
  using (user_id = auth.uid());

-- Any authenticated user can insert a notification (the follow action creates one)
create policy "Authenticated users can create notifications"
  on notification for insert
  with check (auth.uid() is not null);

-- Users can update (mark read) their own notifications
create policy "Users can update own notifications"
  on notification for update
  using (user_id = auth.uid());
