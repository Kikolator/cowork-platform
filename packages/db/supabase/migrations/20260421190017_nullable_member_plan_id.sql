-- Migration: nullable_member_plan_id
-- Allow members to exist without an assigned plan (e.g. imported members with
-- no matching plan). Members without a plan are set to status 'churned' and
-- excluded from capacity calculations and credit grants.
--
-- Rollback:
--   UPDATE members SET plan_id = (SELECT id FROM plans WHERE space_id = members.space_id LIMIT 1) WHERE plan_id IS NULL;
--   ALTER TABLE members ALTER COLUMN plan_id SET NOT NULL;
--   -- Then recreate get_space_capacity / check_space_capacity without the plan_id IS NOT NULL filter.

-- 1. Drop the NOT NULL constraint (metadata-only change, no table rewrite)
ALTER TABLE members ALTER COLUMN plan_id DROP NOT NULL;

-- 2. Recreate get_space_capacity to explicitly exclude null plan_id members
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

  -- Sum consumed capacity from active members (null plan_id = 0 weight)
  SELECT COALESCE(SUM(p.desk_weight), 0) INTO v_consumed
  FROM members m
  JOIN plans p ON p.id = m.plan_id
  WHERE m.space_id = p_space_id
    AND m.plan_id IS NOT NULL
    AND m.status IN ('active', 'paused', 'past_due', 'cancelling');

  v_remaining := v_total_desks - v_consumed;

  RETURN jsonb_build_object(
    'total_desks', v_total_desks,
    'consumed', round(v_consumed, 4),
    'remaining', round(v_remaining, 4)
  );
END;
$$;

-- 3. Recreate check_space_capacity with same null guard
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

  -- Sum consumed capacity from active members, excluding null plan_id
  SELECT COALESCE(SUM(p.desk_weight), 0) INTO v_consumed
  FROM members m
  JOIN plans p ON p.id = m.plan_id
  WHERE m.space_id = p_space_id
    AND m.plan_id IS NOT NULL
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
