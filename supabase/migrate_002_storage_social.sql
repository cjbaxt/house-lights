-- migrate_002_storage_social.sql
-- Run in Supabase SQL editor
-- Creates: avatars storage bucket, friendship request model upgrade

-- ============================================================
-- Storage: avatars bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, 2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatars public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Avatar upload own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Avatar update own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Avatar delete own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- Friendship: add status column for pending/accepted requests
-- ============================================================

ALTER TABLE friendship ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted';
-- existing rows are bilateral accepted friendships, keep them

-- Index for feed queries
CREATE INDEX IF NOT EXISTS friendship_friend_id_idx ON friendship(friend_id);
