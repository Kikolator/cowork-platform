----------------------------------------------------------------------
-- Migration: rls_jwt_helpers
--
-- Creates helper functions for JWT claim access and updates all RLS
-- policies to use them instead of raw JWT accessors.
-- If the JWT structure ever changes, update one function instead of 50+.
----------------------------------------------------------------------

----------------------------------------------------------------------
-- 1. Helper functions
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION current_space_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'space_id')::uuid;
$$;

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid;
$$;

CREATE OR REPLACE FUNCTION current_space_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'space_role';
$$;

----------------------------------------------------------------------
-- 2. Update verify_space_access()
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION verify_space_access(p_space_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF current_space_id() IS DISTINCT FROM p_space_id
     AND NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  THEN
    RAISE EXCEPTION 'Space access denied' USING ERRCODE = 'P0003';
  END IF;
END;
$$;

----------------------------------------------------------------------
-- 3. Drop and recreate all RLS policies that reference JWT space_id
----------------------------------------------------------------------

-- ===== spaces =====
DROP POLICY space_admins_manage ON spaces;
CREATE POLICY space_admins_manage ON spaces FOR ALL
  USING (is_space_admin(auth.uid(), id) AND id = current_space_id());

-- ===== shared_profiles =====
DROP POLICY space_admins_read_space_profiles ON shared_profiles;
CREATE POLICY space_admins_read_space_profiles ON shared_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM space_users su
      WHERE su.user_id = shared_profiles.id
        AND su.space_id = current_space_id()
    )
    AND is_space_admin(auth.uid(), current_space_id())
  );

-- ===== space_users =====
DROP POLICY space_admins_manage ON space_users;
CREATE POLICY space_admins_manage ON space_users FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

-- ===== resource_types =====
DROP POLICY public_read ON resource_types;
CREATE POLICY public_read ON resource_types FOR SELECT
  USING (space_id = current_space_id());

DROP POLICY space_admins_manage ON resource_types;
CREATE POLICY space_admins_manage ON resource_types FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

-- ===== rate_config =====
DROP POLICY public_read ON rate_config;
CREATE POLICY public_read ON rate_config FOR SELECT
  USING (space_id = current_space_id());

DROP POLICY space_admins_manage ON rate_config;
CREATE POLICY space_admins_manage ON rate_config FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

-- ===== plans =====
DROP POLICY public_read ON plans;
CREATE POLICY public_read ON plans FOR SELECT
  USING (space_id = current_space_id());

DROP POLICY space_admins_manage ON plans;
CREATE POLICY space_admins_manage ON plans FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

-- ===== plan_credit_config =====
DROP POLICY public_read ON plan_credit_config;
CREATE POLICY public_read ON plan_credit_config FOR SELECT
  USING (space_id = current_space_id());

DROP POLICY space_admins_manage ON plan_credit_config;
CREATE POLICY space_admins_manage ON plan_credit_config FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

-- ===== resources =====
DROP POLICY public_read ON resources;
CREATE POLICY public_read ON resources FOR SELECT
  USING (space_id = current_space_id());

DROP POLICY space_admins_manage ON resources;
CREATE POLICY space_admins_manage ON resources FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

-- ===== members =====
DROP POLICY space_admins_manage ON members;
CREATE POLICY space_admins_manage ON members FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

DROP POLICY users_read_own ON members;
CREATE POLICY users_read_own ON members FOR SELECT
  USING (user_id = auth.uid() AND space_id = current_space_id());

-- ===== member_notes =====
DROP POLICY space_admins_manage ON member_notes;
CREATE POLICY space_admins_manage ON member_notes FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

-- ===== products =====
DROP POLICY public_read ON products;
CREATE POLICY public_read ON products FOR SELECT
  USING (space_id = current_space_id());

DROP POLICY space_admins_manage ON products;
CREATE POLICY space_admins_manage ON products FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

-- ===== bookings =====
DROP POLICY space_admins_manage ON bookings;
CREATE POLICY space_admins_manage ON bookings FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

DROP POLICY users_read_own ON bookings;
CREATE POLICY users_read_own ON bookings FOR SELECT
  USING (user_id = auth.uid() AND space_id = current_space_id());

-- ===== recurring_rules =====
DROP POLICY space_admins_manage ON recurring_rules;
CREATE POLICY space_admins_manage ON recurring_rules FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

DROP POLICY users_read_own ON recurring_rules;
CREATE POLICY users_read_own ON recurring_rules FOR SELECT
  USING (user_id = auth.uid() AND space_id = current_space_id());

-- ===== passes =====
DROP POLICY space_admins_manage ON passes;
CREATE POLICY space_admins_manage ON passes FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

DROP POLICY users_read_own ON passes;
CREATE POLICY users_read_own ON passes FOR SELECT
  USING (user_id = auth.uid() AND space_id = current_space_id());

-- ===== credit_grants =====
DROP POLICY space_admins_manage ON credit_grants;
CREATE POLICY space_admins_manage ON credit_grants FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

DROP POLICY users_read_own ON credit_grants;
CREATE POLICY users_read_own ON credit_grants FOR SELECT
  USING (user_id = auth.uid() AND space_id = current_space_id());

-- ===== booking_credit_deductions =====
DROP POLICY space_admins_manage ON booking_credit_deductions;
CREATE POLICY space_admins_manage ON booking_credit_deductions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_credit_deductions.booking_id
        AND b.space_id = current_space_id()
        AND is_space_admin(auth.uid(), b.space_id)
    )
  );

DROP POLICY users_read_own ON booking_credit_deductions;
CREATE POLICY users_read_own ON booking_credit_deductions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_credit_deductions.booking_id
        AND b.user_id = auth.uid()
        AND b.space_id = current_space_id()
    )
  );

-- ===== leads =====
DROP POLICY space_admins_manage ON leads;
CREATE POLICY space_admins_manage ON leads FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

-- ===== payment_events =====
DROP POLICY space_admins_manage ON payment_events;
CREATE POLICY space_admins_manage ON payment_events FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

-- ===== monthly_stats =====
DROP POLICY space_admins_manage ON monthly_stats;
CREATE POLICY space_admins_manage ON monthly_stats FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

-- ===== daily_stats =====
DROP POLICY space_admins_manage ON daily_stats;
CREATE POLICY space_admins_manage ON daily_stats FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

-- ===== space_closures =====
DROP POLICY public_read ON space_closures;
CREATE POLICY public_read ON space_closures FOR SELECT
  USING (space_id = current_space_id());

DROP POLICY space_admins_manage ON space_closures;
CREATE POLICY space_admins_manage ON space_closures FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

-- ===== notifications_log =====
DROP POLICY space_admins_manage ON notifications_log;
CREATE POLICY space_admins_manage ON notifications_log FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

-- ===== waitlist =====
DROP POLICY space_admins_manage ON waitlist;
CREATE POLICY space_admins_manage ON waitlist FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

DROP POLICY users_read_own ON waitlist;
CREATE POLICY users_read_own ON waitlist FOR SELECT
  USING (user_id = auth.uid() AND space_id = current_space_id());

-- ===== notification_preferences =====
DROP POLICY space_admins_manage ON notification_preferences;
CREATE POLICY space_admins_manage ON notification_preferences FOR ALL
  USING (is_space_admin(auth.uid(), space_id) AND space_id = current_space_id());

DROP POLICY users_read_own ON notification_preferences;
CREATE POLICY users_read_own ON notification_preferences FOR SELECT
  USING (user_id = auth.uid() AND space_id = current_space_id());

DROP POLICY users_update_own ON notification_preferences;
CREATE POLICY users_update_own ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid() AND space_id = current_space_id());

----------------------------------------------------------------------
-- 4. Rollback
----------------------------------------------------------------------
-- To roll back this migration:
--
--   DROP FUNCTION IF EXISTS current_space_id();
--   DROP FUNCTION IF EXISTS current_tenant_id();
--   DROP FUNCTION IF EXISTS current_space_role();
--
--   -- Recreate verify_space_access() with raw accessor:
--   CREATE OR REPLACE FUNCTION verify_space_access(p_space_id uuid)
--   RETURNS void LANGUAGE plpgsql STABLE SET search_path = public AS $$
--   BEGIN
--     IF (auth.jwt() ->> 'space_id')::uuid IS DISTINCT FROM p_space_id
--        AND NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
--     THEN RAISE EXCEPTION 'Space access denied' USING ERRCODE = 'P0003';
--     END IF;
--   END; $$;
--
--   -- Then DROP + CREATE each policy above, replacing current_space_id()
--   -- with (auth.jwt() ->> 'space_id')::uuid (the original raw accessor).
