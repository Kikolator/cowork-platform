-- ============================================================================
-- Migration: expire_purchased_credits_on_churn
-- Description: Add function to expire purchased/manual/refund credits when a
--              member's subscription ends. Purchased credits should only remain
--              valid while the plan is active.
-- ============================================================================

-- expire_purchased_credits
-- Expires all non-subscription credits (purchase, manual, refund) for a member.
-- Called when a subscription is deleted (member churns).
CREATE FUNCTION expire_purchased_credits(
  p_space_id uuid,
  p_user_id  uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count integer;
BEGIN
  PERFORM verify_space_access(p_space_id);

  WITH expired AS (
    UPDATE credit_grants
    SET used_minutes = amount_minutes,
        updated_at = now()
    WHERE space_id = p_space_id
      AND user_id = p_user_id
      AND source IN ('purchase', 'manual', 'refund')
      AND used_minutes < amount_minutes
    RETURNING id
  )
  SELECT count(*)::integer INTO v_expired_count FROM expired;

  RETURN v_expired_count;
END;
$$;

-- ==========================================================================
-- Rollback
-- ==========================================================================
-- DROP FUNCTION IF EXISTS expire_purchased_credits(uuid, uuid);
