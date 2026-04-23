-- ============================================================================
-- Migration: 20260422185101_desk_availability_pass_aware
-- Description: Update get_desk_availability to account for active passes
--              overlapping the requested date, not just bookings.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_desk_availability(p_space_id uuid, p_date date)
RETURNS TABLE(total_desks integer, booked_desks integer, available_desks integer)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_timezone text;
  v_is_closed boolean;
  v_day_start timestamptz;
  v_day_end   timestamptz;
  v_total     integer;
  v_booked    integer;
  v_pass_desks integer;
  v_combined  integer;
BEGIN
  PERFORM verify_space_access(p_space_id);

  -- Get space timezone
  SELECT s.timezone INTO v_timezone
  FROM spaces s WHERE s.id = p_space_id;

  -- Check if space is closed on this date
  SELECT EXISTS (
    SELECT 1 FROM space_closures sc
    WHERE sc.space_id = p_space_id
      AND sc.date = p_date
      AND sc.all_day = true
  ) INTO v_is_closed;

  IF v_is_closed THEN
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  -- Day boundaries in space timezone
  v_day_start := (p_date || ' 00:00:00')::timestamp AT TIME ZONE v_timezone;
  v_day_end   := ((p_date + 1) || ' 00:00:00')::timestamp AT TIME ZONE v_timezone;

  -- Total available desks
  SELECT count(*)::integer INTO v_total
  FROM resources r
  JOIN resource_types rt ON r.resource_type_id = rt.id
  WHERE r.space_id = p_space_id
    AND rt.slug = 'desk'
    AND r.status = 'available';

  -- Desks with a non-cancelled booking overlapping this day
  SELECT count(DISTINCT b.resource_id)::integer INTO v_booked
  FROM bookings b
  JOIN resources r ON b.resource_id = r.id
  JOIN resource_types rt ON r.resource_type_id = rt.id
  WHERE b.space_id = p_space_id
    AND rt.slug = 'desk'
    AND b.status NOT IN ('cancelled')
    AND b.start_time < v_day_end
    AND b.end_time   > v_day_start;

  -- Distinct desks occupied by active passes overlapping this date.
  -- Uses NOT EXISTS to exclude desks already counted as booked
  -- (avoids double-counting if a desk has both a booking and a pass).
  -- count(DISTINCT) handles multiple passes on the same desk.
  SELECT count(DISTINCT p.assigned_desk_id)::integer INTO v_pass_desks
  FROM passes p
  WHERE p.space_id = p_space_id
    AND p.status = 'active'
    AND p.start_date <= p_date
    AND p.end_date   >= p_date
    AND p.assigned_desk_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM bookings b
      JOIN resources r ON b.resource_id = r.id
      JOIN resource_types rt ON r.resource_type_id = rt.id
      WHERE b.resource_id = p.assigned_desk_id
        AND b.space_id = p_space_id
        AND rt.slug = 'desk'
        AND b.status NOT IN ('cancelled')
        AND b.start_time < v_day_end
        AND b.end_time   > v_day_start
    );

  -- Combined count (bookings + passes), reported as booked_desks for
  -- backward compatibility with callers.
  v_combined := v_booked + v_pass_desks;

  RETURN QUERY SELECT v_total, v_combined, GREATEST(v_total - v_combined, 0);
END;
$$;

-- ============================================================================
-- Rollback
-- ============================================================================
-- To revert, restore the original function from 00007_bookings.sql:
--
-- CREATE OR REPLACE FUNCTION get_desk_availability(p_space_id uuid, p_date date)
-- RETURNS TABLE(total_desks integer, booked_desks integer, available_desks integer)
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- STABLE
-- SET search_path = public
-- AS $$
-- DECLARE
--   v_timezone text;
--   v_is_closed boolean;
--   v_day_start timestamptz;
--   v_day_end   timestamptz;
--   v_total     integer;
--   v_booked    integer;
-- BEGIN
--   PERFORM verify_space_access(p_space_id);
--   SELECT s.timezone INTO v_timezone
--   FROM spaces s WHERE s.id = p_space_id;
--   SELECT EXISTS (
--     SELECT 1 FROM space_closures sc
--     WHERE sc.space_id = p_space_id
--       AND sc.date = p_date
--       AND sc.all_day = true
--   ) INTO v_is_closed;
--   IF v_is_closed THEN
--     RETURN QUERY SELECT 0, 0, 0;
--     RETURN;
--   END IF;
--   v_day_start := (p_date || ' 00:00:00')::timestamp AT TIME ZONE v_timezone;
--   v_day_end   := ((p_date + 1) || ' 00:00:00')::timestamp AT TIME ZONE v_timezone;
--   SELECT count(*)::integer INTO v_total
--   FROM resources r
--   JOIN resource_types rt ON r.resource_type_id = rt.id
--   WHERE r.space_id = p_space_id
--     AND rt.slug = 'desk'
--     AND r.status = 'available';
--   SELECT count(DISTINCT b.resource_id)::integer INTO v_booked
--   FROM bookings b
--   JOIN resources r ON b.resource_id = r.id
--   JOIN resource_types rt ON r.resource_type_id = rt.id
--   WHERE b.space_id = p_space_id
--     AND rt.slug = 'desk'
--     AND b.status NOT IN ('cancelled')
--     AND b.start_time < v_day_end
--     AND b.end_time   > v_day_start;
--   RETURN QUERY SELECT v_total, v_booked, (v_total - v_booked);
-- END;
-- $$;
