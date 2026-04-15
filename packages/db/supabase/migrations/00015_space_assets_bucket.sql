----------------------------------------------------------------------
-- Migration: space_assets_bucket
--
-- Creates a public storage bucket for space branding assets (logos,
-- favicons) with RLS policies scoped per-space.
----------------------------------------------------------------------

----------------------------------------------------------------------
-- 1. Create the bucket
----------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'space-assets',
  'space-assets',
  true,
  2097152,  -- 2 MB
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

----------------------------------------------------------------------
-- 2. RLS policies on storage.objects
----------------------------------------------------------------------

-- Anyone can view space assets (logos/favicons are public)
CREATE POLICY "public_read_space_assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'space-assets');

-- Space admins can upload files within their space folder
CREATE POLICY "space_admins_insert_space_assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'space-assets'
    AND (storage.foldername(name))[1] = current_space_id()::text
    AND is_space_admin(auth.uid(), current_space_id())
  );

-- Space admins can overwrite files within their space folder
CREATE POLICY "space_admins_update_space_assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'space-assets'
    AND (storage.foldername(name))[1] = current_space_id()::text
    AND is_space_admin(auth.uid(), current_space_id())
  );

-- Space admins can delete files within their space folder
CREATE POLICY "space_admins_delete_space_assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'space-assets'
    AND (storage.foldername(name))[1] = current_space_id()::text
    AND is_space_admin(auth.uid(), current_space_id())
  );

----------------------------------------------------------------------
-- 3. Rollback
----------------------------------------------------------------------
-- To roll back this migration:
--
--   DROP POLICY IF EXISTS "public_read_space_assets" ON storage.objects;
--   DROP POLICY IF EXISTS "space_admins_insert_space_assets" ON storage.objects;
--   DROP POLICY IF EXISTS "space_admins_update_space_assets" ON storage.objects;
--   DROP POLICY IF EXISTS "space_admins_delete_space_assets" ON storage.objects;
--   DELETE FROM storage.objects WHERE bucket_id = 'space-assets';
--   DELETE FROM storage.buckets WHERE id = 'space-assets';
