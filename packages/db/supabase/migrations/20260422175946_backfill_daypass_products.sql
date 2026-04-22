-- ============================================================================
-- Migration: backfill_daypass_products
-- Description: For spaces with legacy daypass_* columns populated, create
--              corresponding products rows so the products table becomes
--              the single source of truth for pass configuration.
-- Idempotent: uses ON CONFLICT to avoid duplicates on re-run.
-- ============================================================================

-- 1. Create a day-pass product for each space that has daypass enabled + priced.
--    Preserves existing stripe_price_id so we don't create duplicate Stripe prices.
INSERT INTO products (
  space_id,
  name,
  slug,
  description,
  category,
  purchase_flow,
  price_cents,
  currency,
  stripe_price_id,
  pass_type,
  duration_days,
  consecutive_days,
  visibility_rules,
  active,
  sort_order
)
SELECT
  s.id,
  'Day Pass',
  'day-pass',
  'Full day access to the workspace',
  'pass',
  'date_picker',
  s.daypass_price_cents,
  s.daypass_currency,
  s.daypass_stripe_price_id,
  'day',
  1,
  true,
  '{"require_no_membership": false}'::jsonb,
  true,
  0
FROM spaces s
WHERE s.daypass_enabled = true
  AND s.daypass_price_cents IS NOT NULL
ON CONFLICT (space_id, slug) DO NOTHING;

-- 2. Copy daypass_daily_limit → max_pass_desks where not already set.
--    Note: daypass_daily_limit was a per-day issuance cap; max_pass_desks is a
--    concurrent desk limit. They're being merged intentionally — going forward
--    the single max_pass_desks limit controls both concepts.
UPDATE spaces
SET max_pass_desks = daypass_daily_limit
WHERE daypass_daily_limit IS NOT NULL
  AND max_pass_desks IS NULL;

-- ============================================================================
-- Rollback (reverse the backfill — only deletes auto-created products)
-- ============================================================================
-- DELETE FROM products
--   WHERE slug = 'day-pass'
--     AND category = 'pass'
--     AND pass_type = 'day'
--     AND description = 'Full day access to the workspace';
-- UPDATE spaces SET max_pass_desks = NULL
--   WHERE daypass_daily_limit IS NOT NULL
--     AND max_pass_desks = daypass_daily_limit;
