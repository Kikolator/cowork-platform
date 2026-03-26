-- ============================================================================
-- Migration: fix_access_config_rls_jwt_path
-- Description: Fix space_access_config RLS policies to use current_space_id()
--              instead of (auth.jwt() ->> 'space_id')::uuid.
--              This project stores space_id in app_metadata, so the direct
--              JWT read silently fails — same bug fixed for import_jobs in
--              20260320181450.
-- ============================================================================

-- 1. Drop broken policies
DROP POLICY IF EXISTS "space_admins_manage" ON space_access_config;
DROP POLICY IF EXISTS "members_read" ON space_access_config;

-- 2. Recreate with correct helper
CREATE POLICY "space_admins_manage" ON space_access_config
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = current_space_id()
  );

CREATE POLICY "members_read" ON space_access_config
  FOR SELECT USING (
    space_id = current_space_id()
  );

-- ============================================================================
-- Rollback
-- ============================================================================
-- DROP POLICY IF EXISTS "members_read" ON space_access_config;
-- DROP POLICY IF EXISTS "space_admins_manage" ON space_access_config;
-- CREATE POLICY "space_admins_manage" ON space_access_config
--   FOR ALL USING (
--     is_space_admin(auth.uid(), space_id)
--     AND space_id = (auth.jwt() ->> 'space_id')::uuid
--   );
-- CREATE POLICY "members_read" ON space_access_config
--   FOR SELECT USING (
--     space_id = (auth.jwt() ->> 'space_id')::uuid
--   );
