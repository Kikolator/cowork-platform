-- ============================================================================
-- Migration: fix_import_jobs_rls_jwt_path
-- Description: Fix import_jobs RLS policy to use current_space_id() helper
--              instead of raw JWT accessor (auth.jwt() ->> 'space_id') which
--              reads from the JWT root. The space_id is stored in
--              app_metadata, so the policy must use current_space_id() which
--              reads auth.jwt() -> 'app_metadata' ->> 'space_id'.
-- ============================================================================

DROP POLICY IF EXISTS "space_admins_manage" ON import_jobs;

CREATE POLICY "space_admins_manage" ON import_jobs
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = current_space_id()
  );

-- ============================================================================
-- Rollback
-- ============================================================================
-- DROP POLICY IF EXISTS "space_admins_manage" ON import_jobs;
-- CREATE POLICY "space_admins_manage" ON import_jobs
--   FOR ALL USING (
--     is_space_admin(auth.uid(), space_id)
--     AND space_id = (auth.jwt() ->> 'space_id')::uuid
--   );
