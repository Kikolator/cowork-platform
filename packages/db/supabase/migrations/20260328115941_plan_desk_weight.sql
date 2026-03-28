-- Migration: plan_desk_weight
-- Adds desk_weight to plans for ratio-based capacity management.
-- desk_weight represents how much desk capacity each member on this plan consumes.
-- E.g. 1.0 = fixed desk (1:1), 0.3333 = 3 members share 1 desk, 0 = no desk needed.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS check_space_capacity(uuid, uuid, uuid);
--   DROP FUNCTION IF EXISTS get_space_capacity(uuid);
--   ALTER TABLE plans DROP COLUMN desk_weight;

-- 1. Add desk_weight column to plans
ALTER TABLE plans
  ADD COLUMN desk_weight numeric(5,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN plans.desk_weight IS
  'Desk capacity consumed per member on this plan. 1.0 = fixed desk, 0.3333 = 3 members/desk, 0 = no desk.';

-- Backfill: fixed desk plans get weight 1.0
UPDATE plans SET desk_weight = 1.0 WHERE has_fixed_desk = true;

-- 2. Function: get overall space capacity summary
CREATE OR REPLACE FUNCTION get_space_capacity(p_space_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_total_desks integer;
  v_consumed numeric;
  v_remaining numeric;
BEGIN
  -- Count available desks in the space
  SELECT count(*) INTO v_total_desks
  FROM resources r
  JOIN resource_types rt ON rt.id = r.resource_type_id
  WHERE r.space_id = p_space_id
    AND rt.slug = 'desk'
    AND r.status = 'available';

  -- Sum consumed capacity from active members
  SELECT COALESCE(SUM(p.desk_weight), 0) INTO v_consumed
  FROM members m
  JOIN plans p ON p.id = m.plan_id
  WHERE m.space_id = p_space_id
    AND m.status IN ('active', 'paused', 'past_due', 'cancelling');

  v_remaining := v_total_desks - v_consumed;

  RETURN jsonb_build_object(
    'total_desks', v_total_desks,
    'consumed', round(v_consumed, 4),
    'remaining', round(v_remaining, 4)
  );
END;
$$;

COMMENT ON FUNCTION get_space_capacity(uuid) IS
  'Returns total desk capacity, consumed capacity, and remaining capacity for a space.';

-- 3. Function: check if a space has capacity for a given plan
CREATE OR REPLACE FUNCTION check_space_capacity(
  p_space_id uuid,
  p_plan_id uuid,
  p_exclude_member_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_total_desks integer;
  v_consumed numeric;
  v_plan_weight numeric;
  v_remaining numeric;
BEGIN
  -- Count available desks
  SELECT count(*) INTO v_total_desks
  FROM resources r
  JOIN resource_types rt ON rt.id = r.resource_type_id
  WHERE r.space_id = p_space_id
    AND rt.slug = 'desk'
    AND r.status = 'available';

  -- Get the plan's desk weight
  SELECT desk_weight INTO v_plan_weight
  FROM plans
  WHERE id = p_plan_id AND space_id = p_space_id;

  IF v_plan_weight IS NULL THEN
    RETURN jsonb_build_object('error', 'Plan not found');
  END IF;

  -- Plans with 0 weight always have capacity (virtual office, etc.)
  IF v_plan_weight = 0 THEN
    RETURN jsonb_build_object(
      'total_desks', v_total_desks,
      'consumed', 0,
      'remaining', v_total_desks,
      'plan_weight', 0,
      'has_capacity', true
    );
  END IF;

  -- Sum consumed capacity from active members, optionally excluding one (for plan changes)
  SELECT COALESCE(SUM(p.desk_weight), 0) INTO v_consumed
  FROM members m
  JOIN plans p ON p.id = m.plan_id
  WHERE m.space_id = p_space_id
    AND m.status IN ('active', 'paused', 'past_due', 'cancelling')
    AND (p_exclude_member_id IS NULL OR m.id != p_exclude_member_id);

  v_remaining := v_total_desks - v_consumed;

  RETURN jsonb_build_object(
    'total_desks', v_total_desks,
    'consumed', round(v_consumed, 4),
    'remaining', round(v_remaining, 4),
    'plan_weight', v_plan_weight,
    'has_capacity', v_remaining >= v_plan_weight
  );
END;
$$;

COMMENT ON FUNCTION check_space_capacity(uuid, uuid, uuid) IS
  'Checks if a space has desk capacity for a new member on the given plan. Use p_exclude_member_id for plan changes.';
