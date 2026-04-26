-- Track Vercel domain verification status for custom domains
ALTER TABLE spaces
  ADD COLUMN domain_status text
  CHECK (domain_status IN ('pending', 'active', 'error'));

COMMENT ON COLUMN spaces.domain_status IS
  'Vercel domain verification status: pending (DNS not verified), active (verified + SSL), error (configuration failed), NULL (no custom domain)';

-- Backfill: existing custom domains are assumed active (manually configured)
UPDATE spaces SET domain_status = 'active' WHERE custom_domain IS NOT NULL;

-- Rollback:
-- ALTER TABLE spaces DROP COLUMN IF EXISTS domain_status;
