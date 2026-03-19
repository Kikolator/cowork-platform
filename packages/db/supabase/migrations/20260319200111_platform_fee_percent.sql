-- Migration: platform_fee_percent
-- Description: Add per-tenant platform fee override column
-- Rollback: ALTER TABLE tenants DROP COLUMN platform_fee_percent;

ALTER TABLE tenants
  ADD COLUMN platform_fee_percent smallint
  CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 50);

COMMENT ON COLUMN tenants.platform_fee_percent IS
  'Per-tenant fee override (%). NULL = use plan default (free=5, pro=3, enterprise=1).';
