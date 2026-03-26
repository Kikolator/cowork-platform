-- ============================================================================
-- Migration: restrict_access_config_member_view
-- Description: Replace the broad members_read SELECT policy on
--              space_access_config with a restricted one that only allows
--              space admins to read all columns. Regular members use a
--              SECURITY DEFINER function that returns only safe columns
--              (excludes nuki_api_token, nuki_smartlock_id, etc.).
-- ============================================================================

-- 1. Drop the overly permissive member read policy
--    (recreated in the previous JWT-fix migration, so drop that version)
DROP POLICY IF EXISTS "members_read" ON space_access_config;

-- 2. Create a safe read function for members
CREATE OR REPLACE FUNCTION get_member_access_config(p_space_id uuid)
RETURNS TABLE (
  space_id uuid,
  enabled boolean,
  mode text,
  code_business_hours text,
  code_extended text,
  code_twenty_four_seven text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sac.space_id,
    sac.enabled,
    sac.mode,
    sac.code_business_hours,
    sac.code_extended,
    sac.code_twenty_four_seven
  FROM space_access_config sac
  WHERE sac.space_id = p_space_id;
$$;

-- 3. Only admins can SELECT directly on the table (full row including secrets)
CREATE POLICY "space_admins_read" ON space_access_config
  FOR SELECT USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = current_space_id()
  );

-- ============================================================================
-- Rollback
-- ============================================================================
-- DROP POLICY IF EXISTS "space_admins_read" ON space_access_config;
-- DROP FUNCTION IF EXISTS get_member_access_config(uuid);
-- CREATE POLICY "members_read" ON space_access_config
--   FOR SELECT USING (space_id = current_space_id());
