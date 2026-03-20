----------------------------------------------------------------------
-- Migration: add_resource_image_url
--
-- Adds an optional image_url column to resources so tenants can
-- upload a photo of each desk / room for members to see when booking.
----------------------------------------------------------------------

ALTER TABLE resources
  ADD COLUMN image_url text;

COMMENT ON COLUMN resources.image_url IS
  'Public URL of the resource photo (stored in space-assets bucket)';

----------------------------------------------------------------------
-- Rollback
----------------------------------------------------------------------
-- ALTER TABLE resources DROP COLUMN IF EXISTS image_url;
