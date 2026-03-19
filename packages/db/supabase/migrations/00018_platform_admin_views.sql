----------------------------------------------------------------------
-- Migration: platform_admin_views
--
-- Adds helper function for aggregated platform statistics.
-- Used by the platform admin dashboard (apps/admin).
----------------------------------------------------------------------

----------------------------------------------------------------------
-- 1. Platform stats aggregation function
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Verify caller is platform admin
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not a platform admin' USING ERRCODE = 'P0004';
  END IF;

  SELECT jsonb_build_object(
    'total_tenants', (SELECT count(*) FROM tenants),
    'active_tenants', (SELECT count(*) FROM tenants WHERE status = 'active'),
    'trial_tenants', (SELECT count(*) FROM tenants WHERE status = 'trial'),
    'suspended_tenants', (SELECT count(*) FROM tenants WHERE status = 'suspended'),
    'churned_tenants', (SELECT count(*) FROM tenants WHERE status = 'churned'),
    'total_spaces', (SELECT count(*) FROM spaces WHERE active = true),
    'total_members', (SELECT count(*) FROM members WHERE status = 'active'),
    'total_past_due', (SELECT count(*) FROM members WHERE status = 'past_due'),
    'total_mrr_cents', (
      SELECT coalesce(sum(ms.mrr_cents), 0)
      FROM monthly_stats ms
      WHERE ms.month = date_trunc('month', current_date)::date
    ),
    'stripe_connected', (
      SELECT count(*) FROM tenants WHERE stripe_onboarding_complete = true
    )
  ) INTO result;

  RETURN result;
END;
$$;

----------------------------------------------------------------------
-- 2. Rollback
----------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS get_platform_stats();
