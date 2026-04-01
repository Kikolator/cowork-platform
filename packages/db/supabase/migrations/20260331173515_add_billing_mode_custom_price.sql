-- ============================================================================
-- Migration: add_billing_mode_custom_price
-- Description: Add billing_mode and custom_price_cents to members table
--              for hybrid billing (Stripe vs manual) and per-member pricing
-- ============================================================================

-- ==========================================================================
-- 1. Create enum type
-- ==========================================================================

CREATE TYPE billing_mode AS ENUM ('stripe', 'manual');

-- ==========================================================================
-- 2. Add columns
-- ==========================================================================

ALTER TABLE members
  ADD COLUMN billing_mode billing_mode NOT NULL DEFAULT 'stripe',
  ADD COLUMN custom_price_cents integer
    CHECK (custom_price_cents IS NULL OR custom_price_cents >= 0);

-- Backfill: members with a Stripe subscription stay 'stripe' (the default).
-- Members without a subscription (admin-created, no payment) → 'manual'.
UPDATE members
  SET billing_mode = 'manual'
  WHERE stripe_subscription_id IS NULL
    AND stripe_customer_id IS NULL;

-- ==========================================================================
-- 3. Rollback
-- ==========================================================================
-- ALTER TABLE members DROP COLUMN custom_price_cents;
-- ALTER TABLE members DROP COLUMN billing_mode;
-- DROP TYPE IF EXISTS billing_mode;
