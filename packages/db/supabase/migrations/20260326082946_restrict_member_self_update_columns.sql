-- ============================================================================
-- Migration: restrict_member_self_update_columns
-- Description: Prevent regular members from modifying security-sensitive
--              columns on their own member row. The users_update_own RLS
--              policy (00018) allows UPDATE on any column — this trigger
--              rejects changes to protected fields unless the caller is
--              service_role or a space admin.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_member_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypasses all checks (webhooks, admin client)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Space admins and platform admins can update any column
  IF is_space_admin(auth.uid(), NEW.space_id) THEN
    RETURN NEW;
  END IF;
  IF is_platform_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Regular members: reject changes to protected columns
  IF OLD.plan_id IS DISTINCT FROM NEW.plan_id
     OR OLD.status IS DISTINCT FROM NEW.status
     OR OLD.fixed_desk_id IS DISTINCT FROM NEW.fixed_desk_id
     OR OLD.access_code IS DISTINCT FROM NEW.access_code
     OR OLD.has_twenty_four_seven IS DISTINCT FROM NEW.has_twenty_four_seven
     OR OLD.alarm_approved IS DISTINCT FROM NEW.alarm_approved
     OR OLD.stripe_customer_id IS DISTINCT FROM NEW.stripe_customer_id
     OR OLD.stripe_subscription_id IS DISTINCT FROM NEW.stripe_subscription_id
     OR OLD.nuki_auth_id IS DISTINCT FROM NEW.nuki_auth_id
     OR OLD.joined_at IS DISTINCT FROM NEW.joined_at
     OR OLD.paused_at IS DISTINCT FROM NEW.paused_at
     OR OLD.cancel_requested_at IS DISTINCT FROM NEW.cancel_requested_at
     OR OLD.cancelled_at IS DISTINCT FROM NEW.cancelled_at
     OR OLD.space_id IS DISTINCT FROM NEW.space_id
     OR OLD.user_id IS DISTINCT FROM NEW.user_id
  THEN
    RAISE EXCEPTION 'Cannot modify protected member fields'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_member_self_update
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION check_member_self_update();

-- ============================================================================
-- Rollback
-- ============================================================================
-- DROP TRIGGER IF EXISTS enforce_member_self_update ON members;
-- DROP FUNCTION IF EXISTS check_member_self_update();
