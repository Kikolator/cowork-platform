-- ============================================================================
-- Migration: referrals
-- Description: Referral tracking table. Tracks pending and completed referrals,
--              Stripe coupon IDs, and reward fulfillment state.
-- ============================================================================

-- ==========================================================================
-- 1. Tables
-- ==========================================================================

CREATE TABLE referrals (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id                  uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  referral_code_id          uuid NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,

  -- Referrer
  referrer_member_id        uuid NOT NULL REFERENCES members(id),
  referrer_user_id          uuid NOT NULL REFERENCES auth.users(id),

  -- Referred (nullable until checkout completes)
  referred_user_id          uuid REFERENCES auth.users(id),
  referred_member_id        uuid REFERENCES members(id),
  referred_email            text NOT NULL,

  -- Status
  status                    text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),

  -- Stripe audit trail
  stripe_coupon_id          text,
  referrer_stripe_coupon_id text,

  -- Reward tracking
  referrer_rewarded         boolean NOT NULL DEFAULT false,
  referrer_reward_type      text CHECK (referrer_reward_type IS NULL OR referrer_reward_type IN ('credit', 'discount', 'none')),
  referrer_credit_grant_id  uuid REFERENCES credit_grants(id),

  -- Timestamps
  completed_at              timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ==========================================================================
-- 2. RLS policies
-- ==========================================================================

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Referrers can see their own referrals
CREATE POLICY "referrers_read_own" ON referrals
  FOR SELECT USING (
    referrer_user_id = auth.uid()
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

-- Referred users can see their own referral record
CREATE POLICY "referred_read_own" ON referrals
  FOR SELECT USING (
    referred_user_id = auth.uid()
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON referrals
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON referrals
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 3. Indexes
-- ==========================================================================

CREATE INDEX idx_referrals_space_id ON referrals(space_id);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_member_id, status);
CREATE INDEX idx_referrals_referred_email ON referrals(space_id, referred_email);
CREATE INDEX idx_referrals_code ON referrals(referral_code_id);

-- Prevent the same email from being referred twice in a space (pending or completed)
CREATE UNIQUE INDEX idx_referrals_referred_unique
  ON referrals(space_id, referred_email)
  WHERE status IN ('pending', 'completed');

-- ==========================================================================
-- 4. updated_at trigger
-- ==========================================================================

CREATE TRIGGER set_referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 5. Rollback
-- ==========================================================================
-- DROP TRIGGER IF EXISTS set_referrals_updated_at ON referrals;
-- DROP POLICY IF EXISTS "platform_admins_full" ON referrals;
-- DROP POLICY IF EXISTS "space_admins_manage" ON referrals;
-- DROP POLICY IF EXISTS "referred_read_own" ON referrals;
-- DROP POLICY IF EXISTS "referrers_read_own" ON referrals;
-- DROP TABLE IF EXISTS referrals;
