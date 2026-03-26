-- ============================================================================
-- Migration: add_booking_conflict_check_to_rpc
-- Description: Add atomic conflict checks inside create_booking_with_credits
--              to prevent double-booking via race conditions. Previously the
--              app performed overlap, desk conflict, and pass checks as
--              separate queries before calling the RPC — a window existed
--              where two concurrent bookings could both pass checks.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_booking_with_credits(
  p_space_id     uuid,
  p_user_id      uuid,
  p_resource_id  uuid,
  p_start_time   timestamptz,
  p_end_time     timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id       uuid;
  v_resource_type_id uuid;
  v_duration         integer;
  v_remaining        integer;
  v_is_unlimited     boolean;
  v_grant            record;
  v_to_deduct        integer;
  v_conflict_count   integer;
BEGIN
  PERFORM verify_space_access(p_space_id);

  -- Get resource type
  SELECT r.resource_type_id INTO v_resource_type_id
  FROM resources r
  WHERE r.id = p_resource_id
    AND r.space_id = p_space_id
    AND r.status = 'available';

  IF v_resource_type_id IS NULL THEN
    RAISE EXCEPTION 'Resource not found or unavailable in this space'
      USING ERRCODE = 'P0002';
  END IF;

  -- Check for user's overlapping bookings at the same time
  SELECT count(*) INTO v_conflict_count
  FROM bookings b
  WHERE b.user_id = p_user_id
    AND b.space_id = p_space_id
    AND b.status IN ('confirmed', 'checked_in')
    AND b.start_time < p_end_time
    AND b.end_time > p_start_time;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'You already have a booking during this time slot'
      USING ERRCODE = 'P0001';
  END IF;

  -- Check for desk conflicts (other bookings on same resource)
  SELECT count(*) INTO v_conflict_count
  FROM bookings b
  WHERE b.resource_id = p_resource_id
    AND b.space_id = p_space_id
    AND b.status IN ('confirmed', 'checked_in')
    AND b.start_time < p_end_time
    AND b.end_time > p_start_time;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'This desk is already booked for the selected time'
      USING ERRCODE = 'P0001';
  END IF;

  -- Check for fixed desk assignment to another member
  SELECT count(*) INTO v_conflict_count
  FROM members m
  WHERE m.fixed_desk_id = p_resource_id
    AND m.space_id = p_space_id
    AND m.status = 'active'
    AND m.user_id != p_user_id;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'This desk is assigned to another member'
      USING ERRCODE = 'P0001';
  END IF;

  -- Check for pass conflicts on this desk
  SELECT count(*) INTO v_conflict_count
  FROM passes p
  WHERE p.assigned_desk_id = p_resource_id
    AND p.space_id = p_space_id
    AND p.status = 'active'
    AND p.start_date <= (p_start_time AT TIME ZONE 'UTC')::date
    AND p.end_date >= (p_start_time AT TIME ZONE 'UTC')::date;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'This desk is reserved by a pass holder'
      USING ERRCODE = 'P0001';
  END IF;

  -- Calculate duration in minutes
  v_duration := EXTRACT(EPOCH FROM (p_end_time - p_start_time))::integer / 60;

  -- Check for unlimited credits via plan
  SELECT coalesce(pcc.is_unlimited, false) INTO v_is_unlimited
  FROM members m
  LEFT JOIN plan_credit_config pcc
    ON pcc.plan_id = m.plan_id
    AND pcc.resource_type_id = v_resource_type_id
  WHERE m.space_id = p_space_id
    AND m.user_id = p_user_id
    AND m.status = 'active';

  -- Create the booking
  INSERT INTO bookings (
    space_id, user_id, resource_id,
    start_time, end_time, status,
    duration_minutes, credit_type_id, credits_deducted
  ) VALUES (
    p_space_id, p_user_id, p_resource_id,
    p_start_time, p_end_time, 'confirmed',
    v_duration, v_resource_type_id, 0
  )
  RETURNING id INTO v_booking_id;

  -- If unlimited, no deduction needed
  IF v_is_unlimited THEN
    UPDATE bookings SET credits_deducted = v_duration
    WHERE id = v_booking_id;
    RETURN v_booking_id;
  END IF;

  -- Deduct from grants: expiring first (valid_until ASC NULLS LAST),
  -- then by source priority (subscription before purchase)
  v_remaining := v_duration;

  FOR v_grant IN
    SELECT cg.id, (cg.amount_minutes - cg.used_minutes) AS available
    FROM credit_grants cg
    WHERE cg.space_id = p_space_id
      AND cg.user_id = p_user_id
      AND cg.resource_type_id = v_resource_type_id
      AND cg.valid_from <= now()
      AND (cg.valid_until IS NULL OR cg.valid_until > now())
      AND cg.used_minutes < cg.amount_minutes
    ORDER BY cg.valid_until ASC NULLS LAST, cg.source ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_to_deduct := LEAST(v_grant.available, v_remaining);

    UPDATE credit_grants
    SET used_minutes = used_minutes + v_to_deduct,
        updated_at = now()
    WHERE id = v_grant.id;

    INSERT INTO booking_credit_deductions (booking_id, grant_id, minutes)
    VALUES (v_booking_id, v_grant.id, v_to_deduct);

    v_remaining := v_remaining - v_to_deduct;
  END LOOP;

  -- Update booking with total credits deducted
  UPDATE bookings
  SET credits_deducted = v_duration - v_remaining
  WHERE id = v_booking_id;

  RETURN v_booking_id;
END;
$$;

-- ============================================================================
-- Rollback: revert to original function without conflict checks
-- ============================================================================
-- See 00009_credits.sql for the original function definition
