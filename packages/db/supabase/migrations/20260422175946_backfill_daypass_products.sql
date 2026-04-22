-- ============================================================================
-- Migration: backfill_daypass_products
-- Description: For spaces with legacy daypass_* columns populated, create
--              corresponding products rows so the products table becomes
--              the single source of truth for pass configuration.
-- Idempotent: uses NOT EXISTS guard to avoid duplicates on re-run.
-- ============================================================================

-- 1. Create a day-pass product for each space that has daypass enabled + priced
INSERT INTO products (
  space_id,
  name,
  slug,
  description,
  category,
  purchase_flow,
  price_cents,
  currency,
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
  'day',
  1,
  true,
  '{"require_no_membership": false}'::jsonb,
  true,
  0
FROM spaces s
WHERE s.daypass_enabled = true
  AND s.daypass_price_cents IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.space_id = s.id
      AND p.category = 'pass'
      AND p.pass_type = 'day'
  );

-- 2. Copy daypass_daily_limit → max_pass_desks where not already set
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
-- UPDATE spaces SET max_pass_desks = NULL WHERE max_pass_desks IS NOT NULL;
