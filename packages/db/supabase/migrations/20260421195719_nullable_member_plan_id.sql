-- Make plan_id nullable to support imported members without a matched plan
ALTER TABLE members ALTER COLUMN plan_id DROP NOT NULL;

-- Update capacity functions to handle nullable plan_id

CREATE OR REPLACE FUNCTION get_space_capacity(p_space_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_total_desks integer;
  v_consumed numeric;
  v_remaining numeric;
BEGIN
  SELECT count(*) INTO v_total_desks
  FROM resources r
  JOIN resource_types rt ON rt.id = r.resource_type_id
  WHERE r.space_id = p_space_id
    AND rt.slug = 'desk'
    AND r.status = 'available';

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
  SELECT count(*) INTO v_total_desks
  FROM resources r
  JOIN resource_types rt ON rt.id = r.resource_type_id
  WHERE r.space_id = p_space_id
    AND rt.slug = 'desk'
    AND r.status = 'available';

  SELECT desk_weight INTO v_plan_weight
  FROM plans
  WHERE id = p_plan_id AND space_id = p_space_id;

  IF v_plan_weight IS NULL THEN
    RETURN jsonb_build_object('error', 'Plan not found');
  END IF;

  IF v_plan_weight = 0 THEN
    RETURN jsonb_build_object(
      'total_desks', v_total_desks,
      'consumed', 0,
      'remaining', v_total_desks,
      'plan_weight', 0,
      'has_capacity', true
    );
  END IF;

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

-- Rollback:
-- ALTER TABLE members ALTER COLUMN plan_id SET NOT NULL;
-- (restore previous function versions from migration 20260328115941)
