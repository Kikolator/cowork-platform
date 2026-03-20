-- Fix: verify_space_access must allow service_role through.
-- The service_role client (used by webhook handlers) has no JWT claims,
-- so current_space_id() and auth.uid() are both NULL, causing all
-- SECURITY DEFINER RPCs that call verify_space_access to silently fail.
-- Inside SECURITY DEFINER, current_setting('role') returns the definer
-- (postgres), not the caller — so we check PostgREST JWT GUCs instead.
--
-- Rollback: re-run the CREATE OR REPLACE from migration 00013.

CREATE OR REPLACE FUNCTION verify_space_access(p_space_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  -- Service-role (admin) client bypasses the space check.
  -- PostgREST sets request.jwt.claim.role as a GUC which persists
  -- inside SECURITY DEFINER functions (unlike current_setting('role')).
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN;
  END IF;

  -- Also bypass when there is no JWT context at all (direct postgres / migration)
  IF current_setting('request.jwt.claims', true) IS NULL
     OR current_setting('request.jwt.claims', true) = '' THEN
    RETURN;
  END IF;

  IF current_space_id() IS DISTINCT FROM p_space_id
     AND NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  THEN
    RAISE EXCEPTION 'Space access denied' USING ERRCODE = 'P0003';
  END IF;
END;
$$;
