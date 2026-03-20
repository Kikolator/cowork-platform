-- Fix: verify_space_access must allow service_role through.
-- The service_role client (used by webhook handlers) has no JWT claims,
-- so current_space_id() and auth.uid() are both NULL, causing all
-- SECURITY DEFINER RPCs that call verify_space_access to silently fail.
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
  -- This is safe because service_role already bypasses RLS.
  IF current_setting('role', true) = 'service_role' THEN
    RETURN;
  END IF;

  IF current_space_id() IS DISTINCT FROM p_space_id
     AND NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  THEN
    RAISE EXCEPTION 'Space access denied' USING ERRCODE = 'P0003';
  END IF;
END;
$$;
