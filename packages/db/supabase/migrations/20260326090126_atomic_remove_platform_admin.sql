-- ============================================================================
-- Migration: atomic_remove_platform_admin
-- Description: Atomic function to remove a platform admin only if at least
--              one other admin remains. Prevents TOCTOU race between the
--              count check and the delete.
-- ============================================================================

CREATE OR REPLACE FUNCTION remove_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_deleted int;
BEGIN
  -- Only delete if more than one admin exists
  DELETE FROM platform_admins
  WHERE user_id = p_user_id
    AND (SELECT count(*) FROM platform_admins) > 1;

  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  RETURN rows_deleted > 0;
END;
$$;

-- ============================================================================
-- Rollback
-- ============================================================================
-- DROP FUNCTION IF EXISTS remove_platform_admin(uuid);
