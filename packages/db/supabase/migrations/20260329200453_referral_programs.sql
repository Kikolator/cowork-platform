-- ============================================================================
-- Migration: referral_programs
-- Description: Extend credit_grant_source enum with 'referral' value and
--              create the referral_programs configuration table (one per space).
-- ============================================================================

-- ==========================================================================
-- 1. Enum extension
-- ==========================================================================

ALTER TYPE credit_grant_source ADD VALUE IF NOT EXISTS 'referral';

-- ==========================================================================
-- 2. Tables
-- ==========================================================================

CREATE TABLE referral_programs (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id                      uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  active                        boolean NOT NULL DEFAULT true,

  -- Referrer reward configuration
  referrer_reward_type          text NOT NULL DEFAULT 'credit'
                                CHECK (referrer_reward_type IN ('credit', 'discount', 'none')),
  referrer_credit_minutes       integer CHECK (referrer_credit_minutes IS NULL OR referrer_credit_minutes > 0),
  referrer_credit_resource_type_id uuid REFERENCES resource_types(id),
  referrer_discount_percent     integer CHECK (referrer_discount_percent IS NULL OR (referrer_discount_percent > 0 AND referrer_discount_percent <= 100)),
  referrer_discount_months      integer DEFAULT 1 CHECK (referrer_discount_months IS NULL OR (referrer_discount_months > 0 AND referrer_discount_months <= 12)),

  -- Referred member benefit configuration
  referred_discount_percent     integer NOT NULL DEFAULT 0
                                CHECK (referred_discount_percent >= 0 AND referred_discount_percent <= 100),
  referred_discount_months      integer NOT NULL DEFAULT 1
                                CHECK (referred_discount_months > 0 AND referred_discount_months <= 12),

  -- Limits
  max_referrals_per_member      integer CHECK (max_referrals_per_member IS NULL OR max_referrals_per_member > 0),
  max_referrals_total           integer CHECK (max_referrals_total IS NULL OR max_referrals_total > 0),
  code_expiry_days              integer DEFAULT 90 CHECK (code_expiry_days IS NULL OR code_expiry_days > 0),

  -- Timestamps
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT one_program_per_space UNIQUE (space_id)
);

-- ==========================================================================
-- 3. RLS policies
-- ==========================================================================

ALTER TABLE referral_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read" ON referral_programs
  FOR SELECT USING (
    space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON referral_programs
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON referral_programs
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 4. Indexes
-- ==========================================================================

CREATE INDEX idx_referral_programs_space_id ON referral_programs(space_id);

-- ==========================================================================
-- 5. updated_at trigger
-- ==========================================================================

CREATE TRIGGER set_referral_programs_updated_at
  BEFORE UPDATE ON referral_programs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 6. Rollback
-- ==========================================================================
-- DROP TRIGGER IF EXISTS set_referral_programs_updated_at ON referral_programs;
-- DROP POLICY IF EXISTS "platform_admins_full" ON referral_programs;
-- DROP POLICY IF EXISTS "space_admins_manage" ON referral_programs;
-- DROP POLICY IF EXISTS "members_read" ON referral_programs;
-- DROP TABLE IF EXISTS referral_programs;
-- Note: Cannot remove enum value in PostgreSQL. 'referral' value remains in credit_grant_source.
