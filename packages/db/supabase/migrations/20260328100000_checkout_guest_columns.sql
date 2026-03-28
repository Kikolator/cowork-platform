-- Add columns to support guest checkout flow for day passes and memberships
-- Rollback: ALTER TABLE spaces DROP COLUMN daypass_enabled, DROP COLUMN daypass_daily_limit, DROP COLUMN daypass_stripe_price_id, DROP COLUMN daypass_price_cents, DROP COLUMN daypass_currency;
-- Rollback: ALTER TABLE plans DROP COLUMN capacity;

-- spaces: day pass configuration
ALTER TABLE spaces
  ADD COLUMN daypass_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN daypass_daily_limit integer,
  ADD COLUMN daypass_price_cents integer,
  ADD COLUMN daypass_stripe_price_id text,
  ADD COLUMN daypass_currency text NOT NULL DEFAULT 'eur';

-- plans: optional capacity limit for memberships
ALTER TABLE plans
  ADD COLUMN capacity integer;

COMMENT ON COLUMN spaces.daypass_enabled IS 'Whether day passes can be purchased for this space';
COMMENT ON COLUMN spaces.daypass_daily_limit IS 'Max day passes per day (null = unlimited)';
COMMENT ON COLUMN spaces.daypass_price_cents IS 'Day pass price in cents';
COMMENT ON COLUMN spaces.daypass_stripe_price_id IS 'Stripe price ID for day pass on connected account';
COMMENT ON COLUMN spaces.daypass_currency IS 'Currency for day pass pricing';
COMMENT ON COLUMN plans.capacity IS 'Max active members on this plan (null = unlimited)';
