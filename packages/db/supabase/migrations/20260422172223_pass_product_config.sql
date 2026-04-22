-- ============================================================================
-- Migration: pass_product_config
-- Description: Add pass-specific columns to products, community rules and
--              WiFi to spaces, product linkage and rules acceptance to
--              passes and members.
-- ============================================================================

-- ==========================================================================
-- 1. Products — pass configuration columns
-- ==========================================================================

ALTER TABLE products
  ADD COLUMN pass_type       pass_type,
  ADD COLUMN duration_days   integer CHECK (duration_days > 0),
  ADD COLUMN consecutive_days boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN products.pass_type IS 'day or week — required when category = pass';
COMMENT ON COLUMN products.duration_days IS 'Number of business days for the pass (1 for day pass, 5 for week pass)';
COMMENT ON COLUMN products.consecutive_days IS 'Whether pass days must be consecutive (skipping weekends/closures)';

-- ==========================================================================
-- 2. Spaces — max pass desks, community rules, WiFi
-- ==========================================================================

ALTER TABLE spaces
  ADD COLUMN max_pass_desks       integer CHECK (max_pass_desks > 0),
  ADD COLUMN community_rules_text text,
  ADD COLUMN wifi_network         text,
  ADD COLUMN wifi_password        text;

COMMENT ON COLUMN spaces.max_pass_desks IS 'Max desks allocatable to pass holders at any time (null = no limit)';
COMMENT ON COLUMN spaces.community_rules_text IS 'Community rules / workspace etiquette shown at checkout (markdown)';
COMMENT ON COLUMN spaces.wifi_network IS 'WiFi network name shown to pass holders and members';
COMMENT ON COLUMN spaces.wifi_password IS 'WiFi password shown to pass holders and members';

-- ==========================================================================
-- 3. Passes — link to product + community rules acceptance
-- ==========================================================================

ALTER TABLE passes
  ADD COLUMN product_id                  uuid REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN community_rules_accepted_at timestamptz;

COMMENT ON COLUMN passes.product_id IS 'Product that was purchased for this pass';
COMMENT ON COLUMN passes.community_rules_accepted_at IS 'When the user accepted community rules during checkout';

CREATE INDEX idx_passes_product_id ON passes(product_id)
  WHERE product_id IS NOT NULL;

-- ==========================================================================
-- 4. Members — community rules acceptance
-- ==========================================================================

ALTER TABLE members
  ADD COLUMN community_rules_accepted_at timestamptz;

COMMENT ON COLUMN members.community_rules_accepted_at IS 'When the member accepted community rules during checkout';

-- ==========================================================================
-- 5. Rollback
-- ==========================================================================
-- ALTER TABLE members DROP COLUMN IF EXISTS community_rules_accepted_at;
-- DROP INDEX IF EXISTS idx_passes_product_id;
-- ALTER TABLE passes DROP COLUMN IF EXISTS community_rules_accepted_at;
-- ALTER TABLE passes DROP COLUMN IF EXISTS product_id;
-- ALTER TABLE spaces DROP COLUMN IF EXISTS wifi_password;
-- ALTER TABLE spaces DROP COLUMN IF EXISTS wifi_network;
-- ALTER TABLE spaces DROP COLUMN IF EXISTS community_rules_text;
-- ALTER TABLE spaces DROP COLUMN IF EXISTS max_pass_desks;
-- ALTER TABLE products DROP COLUMN IF EXISTS consecutive_days;
-- ALTER TABLE products DROP COLUMN IF EXISTS duration_days;
-- ALTER TABLE products DROP COLUMN IF EXISTS pass_type;
