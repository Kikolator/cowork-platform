-- ============================================================================
-- Migration: fix_referral_rls_jwt_path
-- Description: Fix RLS policies on referral tables to use current_space_id()
--              instead of (auth.jwt() ->> 'space_id')::uuid. The space_id
--              lives inside app_metadata, so the raw JWT accessor never matches.
-- ============================================================================

-- ==========================================================================
-- 1. referral_programs
-- ==========================================================================

DROP POLICY "members_read" ON referral_programs;
CREATE POLICY "members_read" ON referral_programs
  FOR SELECT USING (
    space_id = current_space_id()
  );

DROP POLICY "space_admins_manage" ON referral_programs;
CREATE POLICY "space_admins_manage" ON referral_programs
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = current_space_id()
  );

-- ==========================================================================
-- 2. referral_codes
-- ==========================================================================

DROP POLICY "members_read_own" ON referral_codes;
CREATE POLICY "members_read_own" ON referral_codes
  FOR SELECT USING (
    user_id = auth.uid()
    AND space_id = current_space_id()
  );

DROP POLICY "space_admins_manage" ON referral_codes;
CREATE POLICY "space_admins_manage" ON referral_codes
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = current_space_id()
  );

-- ==========================================================================
-- 3. referrals
-- ==========================================================================

DROP POLICY "referrers_read_own" ON referrals;
CREATE POLICY "referrers_read_own" ON referrals
  FOR SELECT USING (
    referrer_user_id = auth.uid()
    AND space_id = current_space_id()
  );

DROP POLICY "referred_read_own" ON referrals;
CREATE POLICY "referred_read_own" ON referrals
  FOR SELECT USING (
    referred_user_id = auth.uid()
    AND space_id = current_space_id()
  );

DROP POLICY "space_admins_manage" ON referrals;
CREATE POLICY "space_admins_manage" ON referrals
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = current_space_id()
  );

-- ==========================================================================
-- 4. Rollback
-- ==========================================================================
-- Revert to original (broken) policies:
-- DROP POLICY "members_read" ON referral_programs;
-- CREATE POLICY "members_read" ON referral_programs FOR SELECT USING (space_id = (auth.jwt() ->> 'space_id')::uuid);
-- DROP POLICY "space_admins_manage" ON referral_programs;
-- CREATE POLICY "space_admins_manage" ON referral_programs FOR ALL USING (is_space_admin(auth.uid(), space_id) AND space_id = (auth.jwt() ->> 'space_id')::uuid);
-- DROP POLICY "members_read_own" ON referral_codes;
-- CREATE POLICY "members_read_own" ON referral_codes FOR SELECT USING (user_id = auth.uid() AND space_id = (auth.jwt() ->> 'space_id')::uuid);
-- DROP POLICY "space_admins_manage" ON referral_codes;
-- CREATE POLICY "space_admins_manage" ON referral_codes FOR ALL USING (is_space_admin(auth.uid(), space_id) AND space_id = (auth.jwt() ->> 'space_id')::uuid);
-- DROP POLICY "referrers_read_own" ON referrals;
-- CREATE POLICY "referrers_read_own" ON referrals FOR SELECT USING (referrer_user_id = auth.uid() AND space_id = (auth.jwt() ->> 'space_id')::uuid);
-- DROP POLICY "referred_read_own" ON referrals;
-- CREATE POLICY "referred_read_own" ON referrals FOR SELECT USING (referred_user_id = auth.uid() AND space_id = (auth.jwt() ->> 'space_id')::uuid);
-- DROP POLICY "space_admins_manage" ON referrals;
-- CREATE POLICY "space_admins_manage" ON referrals FOR ALL USING (is_space_admin(auth.uid(), space_id) AND space_id = (auth.jwt() ->> 'space_id')::uuid);
