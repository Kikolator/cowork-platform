-- ============================================================================
-- Migration: pass_refund_columns
-- Description: Add refund tracking to passes and cancellation policy to spaces.
-- ============================================================================

-- ==========================================================================
-- 1. Passes — refund tracking columns
-- ==========================================================================

ALTER TABLE passes
  ADD COLUMN refunded_at         timestamptz,
  ADD COLUMN refund_amount_cents integer CHECK (refund_amount_cents >= 0),
  ADD COLUMN stripe_refund_id    text,
  ADD COLUMN cancellation_reason text;

COMMENT ON COLUMN passes.refunded_at IS 'When the Stripe refund was issued';
COMMENT ON COLUMN passes.refund_amount_cents IS 'Amount refunded in cents';
COMMENT ON COLUMN passes.stripe_refund_id IS 'Stripe refund ID on connected account';
COMMENT ON COLUMN passes.cancellation_reason IS 'Reason for cancellation (user_request, admin_request, etc.)';

-- ==========================================================================
-- 2. Spaces — cancellation policy
-- ==========================================================================

ALTER TABLE spaces
  ADD COLUMN pass_cancel_before_hours integer DEFAULT 24
    CHECK (pass_cancel_before_hours >= 0);

COMMENT ON COLUMN spaces.pass_cancel_before_hours IS 'Hours before pass start_date that self-service cancellation is allowed (0 = no self-service cancel)';

-- ==========================================================================
-- 3. Rollback
-- ==========================================================================
-- ALTER TABLE spaces DROP COLUMN IF EXISTS pass_cancel_before_hours;
-- ALTER TABLE passes DROP COLUMN IF EXISTS cancellation_reason;
-- ALTER TABLE passes DROP COLUMN IF EXISTS stripe_refund_id;
-- ALTER TABLE passes DROP COLUMN IF EXISTS refund_amount_cents;
-- ALTER TABLE passes DROP COLUMN IF EXISTS refunded_at;
