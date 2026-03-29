-- ============================================================================
-- Migration: referral_codes
-- Description: Per-member referral codes, one unique code per member per space.
-- ============================================================================

-- ==========================================================================
-- 1. Tables
-- ==========================================================================

CREATE TABLE referral_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code        text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  uses_count  integer NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_code_per_space UNIQUE (space_id, code),
  CONSTRAINT one_code_per_member UNIQUE (space_id, member_id)
);

-- ==========================================================================
-- 2. RLS policies
-- ==========================================================================

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_own" ON referral_codes
  FOR SELECT USING (
    user_id = auth.uid()
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON referral_codes
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON referral_codes
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 3. Indexes
-- ==========================================================================

CREATE INDEX idx_referral_codes_space_id ON referral_codes(space_id);
CREATE INDEX idx_referral_codes_member_id ON referral_codes(member_id);
CREATE INDEX idx_referral_codes_user_id ON referral_codes(user_id);

-- ==========================================================================
-- 4. updated_at trigger
-- ==========================================================================

CREATE TRIGGER set_referral_codes_updated_at
  BEFORE UPDATE ON referral_codes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 5. Rollback
-- ==========================================================================
-- DROP TRIGGER IF EXISTS set_referral_codes_updated_at ON referral_codes;
-- DROP POLICY IF EXISTS "platform_admins_full" ON referral_codes;
-- DROP POLICY IF EXISTS "space_admins_manage" ON referral_codes;
-- DROP POLICY IF EXISTS "members_read_own" ON referral_codes;
-- DROP TABLE IF EXISTS referral_codes;
