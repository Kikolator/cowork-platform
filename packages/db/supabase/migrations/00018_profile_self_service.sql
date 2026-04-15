----------------------------------------------------------------------
-- Migration: profile_self_service
--
-- Adds RLS policies and storage bucket for member self-service profile
-- editing:
--   1. Members can update their own record (professional/billing fields)
--   2. Members can insert their own notification preferences
--   3. user-avatars storage bucket for avatar uploads
----------------------------------------------------------------------

----------------------------------------------------------------------
-- 1. Members: self-update policy
----------------------------------------------------------------------
-- Members can already SELECT their own row (users_read_own).
-- This policy allows them to UPDATE it. The server action restricts
-- which columns are actually written (professional/billing only —
-- never plan_id, status, fixed_desk_id, access_code, etc.).

CREATE POLICY "users_update_own" ON members
  FOR UPDATE
  USING (user_id = auth.uid() AND space_id = current_space_id())
  WITH CHECK (user_id = auth.uid() AND space_id = current_space_id());

----------------------------------------------------------------------
-- 2. Notification preferences: self-insert policy
----------------------------------------------------------------------
-- Users can already SELECT and UPDATE their own preferences.
-- This allows first-time creation (INSERT) so the upsert works.
-- UNIQUE(space_id, user_id) already exists from 00011.

CREATE POLICY "users_insert_own" ON notification_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND space_id = current_space_id());

----------------------------------------------------------------------
-- 3. user-avatars storage bucket
----------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true,
  2097152,  -- 2 MB
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Anyone can view avatars (public bucket for rendering)
CREATE POLICY "public_read_user_avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-avatars');

-- Users can upload their own avatar (folder = their user id)
CREATE POLICY "users_insert_own_avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can overwrite their own avatar
CREATE POLICY "users_update_own_avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar
CREATE POLICY "users_delete_own_avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

----------------------------------------------------------------------
-- 4. Rollback
----------------------------------------------------------------------
-- DROP POLICY IF EXISTS "users_delete_own_avatar" ON storage.objects;
-- DROP POLICY IF EXISTS "users_update_own_avatar" ON storage.objects;
-- DROP POLICY IF EXISTS "users_insert_own_avatar" ON storage.objects;
-- DROP POLICY IF EXISTS "public_read_user_avatars" ON storage.objects;
-- DELETE FROM storage.objects WHERE bucket_id = 'user-avatars';
-- DELETE FROM storage.buckets WHERE id = 'user-avatars';
-- DROP POLICY IF EXISTS "users_insert_own" ON notification_preferences;
-- DROP POLICY IF EXISTS "users_update_own" ON members;
