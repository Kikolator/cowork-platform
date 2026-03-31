-- Migration: backfill_missing_profiles
-- Purpose: Fix missing shared_profiles rows for auth users created before
-- the handle_new_user() trigger existed, and add a helper function so the
-- application can resolve auth user IDs by email when profiles are absent.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS get_auth_user_id_by_email(text);
--   (backfilled rows are harmless — no rollback needed for the INSERT)

-- ==========================================================================
-- 1. Helper: look up auth user id by email (used by addMember when profile
--    is missing for an existing auth user)
-- ==========================================================================

CREATE OR REPLACE FUNCTION get_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

-- Only callable via service_role (used by addMember admin client).
-- Do NOT grant to authenticated — it would expose email-to-UUID lookups.
-- Supabase propagates PUBLIC grants to anon/authenticated, so revoke explicitly.
REVOKE ALL ON FUNCTION get_auth_user_id_by_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_auth_user_id_by_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION get_auth_user_id_by_email(text) FROM authenticated;

-- ==========================================================================
-- 2. Backfill: create shared_profiles for any auth users missing one
-- ==========================================================================

INSERT INTO shared_profiles (id, email)
SELECT u.id, u.email
FROM auth.users u
LEFT JOIN shared_profiles sp ON sp.id = u.id
WHERE sp.id IS NULL
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
