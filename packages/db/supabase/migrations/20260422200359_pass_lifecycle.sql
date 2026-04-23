-- ============================================================================
-- Migration: pass_lifecycle
-- Description: Add 'upcoming' status to pass_status enum. Update RPCs to
--              treat upcoming passes like active for desk reservation.
--              Update activate_pass to set status conditionally based on
--              start_date vs current date.
-- ============================================================================

-- ==========================================================================
-- 1. Add 'upcoming' to pass_status enum
-- ==========================================================================
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction.
-- Supabase migrations handle this correctly.

ALTER TYPE pass_status ADD VALUE IF NOT EXISTS 'upcoming' BEFORE 'active';

-- ==========================================================================
-- 2. Update activate_pass — set upcoming or active based on start_date
-- ==========================================================================

CREATE OR REPLACE FUNCTION activate_pass(
  p_space_id          uuid,
  p_user_id           uuid,
  p_stripe_session_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pass_id  uuid;
  v_desk_id  uuid;
  v_start    date;
  v_end      date;
  v_status   pass_status;
BEGIN
  PERFORM verify_space_access(p_space_id);

  -- Find the pending pass
  SELECT p.id, p.start_date, p.end_date
  INTO v_pass_id, v_start, v_end
  FROM passes p
  WHERE p.space_id          = p_space_id
    AND p.user_id           = p_user_id
    AND p.stripe_session_id = p_stripe_session_id
    AND p.status            = 'pending_payment';

  IF v_pass_id IS NULL THEN
    RAISE EXCEPTION 'Pass not found or already activated'
      USING ERRCODE = 'P0002';
  END IF;

  -- Determine status: upcoming if start_date is in the future, active otherwise
  IF v_start > CURRENT_DATE THEN
    v_status := 'upcoming';
  ELSE
    v_status := 'active';
  END IF;

  -- Auto-assign a desk
  v_desk_id := auto_assign_desk(p_space_id, v_start, v_end);

  -- Set the pass status
  UPDATE passes
  SET status           = v_status,
      assigned_desk_id = v_desk_id,
      updated_at       = now()
  WHERE id = v_pass_id;

  RETURN v_pass_id;
END;
$$;

-- ==========================================================================
-- 3. Update auto_assign_desk — include 'upcoming' passes in overlap check
-- ==========================================================================

CREATE OR REPLACE FUNCTION auto_assign_desk(
  p_space_id   uuid,
  p_start_date date,
  p_end_date   date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_timezone  text;
  v_desk_id   uuid;
  v_range_start timestamptz;
  v_range_end   timestamptz;
BEGIN
  -- Get space timezone
  SELECT s.timezone INTO v_timezone
  FROM spaces s WHERE s.id = p_space_id;

  v_range_start := (p_start_date || ' 00:00:00')::timestamp AT TIME ZONE v_timezone;
  v_range_end   := ((p_end_date + 1) || ' 00:00:00')::timestamp AT TIME ZONE v_timezone;

  -- Find a desk that has no overlapping bookings or passes
  SELECT r.id INTO v_desk_id
  FROM resources r
  JOIN resource_types rt ON r.resource_type_id = rt.id
  WHERE r.space_id = p_space_id
    AND rt.slug = 'desk'
    AND r.status = 'available'
    -- Not assigned as a fixed desk to any member
    AND r.id NOT IN (
      SELECT m.fixed_desk_id FROM members m
      WHERE m.space_id = p_space_id
        AND m.fixed_desk_id IS NOT NULL
        AND m.status = 'active'
    )
    -- No overlapping bookings
    AND r.id NOT IN (
      SELECT b.resource_id FROM bookings b
      WHERE b.space_id = p_space_id
        AND b.status NOT IN ('cancelled')
        AND b.start_time < v_range_end
        AND b.end_time   > v_range_start
    )
    -- No overlapping active OR upcoming passes
    AND r.id NOT IN (
      SELECT p.assigned_desk_id FROM passes p
      WHERE p.space_id = p_space_id
        AND p.assigned_desk_id IS NOT NULL
        AND p.status IN ('active', 'upcoming')
        AND p.start_date <= p_end_date
        AND p.end_date   >= p_start_date
    )
  ORDER BY r.sort_order, r.name
  LIMIT 1;

  RETURN v_desk_id;
END;
$$;

-- ==========================================================================
-- 4. Update get_desk_availability — include 'upcoming' in pass count
-- ==========================================================================

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

  SELECT s.timezone INTO v_timezone
  FROM spaces s WHERE s.id = p_space_id;

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

  v_day_start := (p_date || ' 00:00:00')::timestamp AT TIME ZONE v_timezone;
  v_day_end   := ((p_date + 1) || ' 00:00:00')::timestamp AT TIME ZONE v_timezone;

  -- Total available desks
  SELECT count(*)::integer INTO v_total
  FROM resources r
  JOIN resource_types rt ON r.resource_type_id = rt.id
  WHERE r.space_id = p_space_id
    AND rt.slug = 'desk'
    AND r.status = 'available';

  -- Desks with bookings
  SELECT count(DISTINCT b.resource_id)::integer INTO v_booked
  FROM bookings b
  JOIN resources r ON b.resource_id = r.id
  JOIN resource_types rt ON r.resource_type_id = rt.id
  WHERE b.space_id = p_space_id
    AND rt.slug = 'desk'
    AND b.status NOT IN ('cancelled')
    AND b.start_time < v_day_end
    AND b.end_time   > v_day_start;

  -- Distinct desks occupied by active/upcoming passes (excluding already-booked desks)
  SELECT count(DISTINCT p.assigned_desk_id)::integer INTO v_pass_desks
  FROM passes p
  WHERE p.space_id = p_space_id
    AND p.status IN ('active', 'upcoming')
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

  v_combined := v_booked + v_pass_desks;

  RETURN QUERY SELECT v_total, v_combined, GREATEST(v_total - v_combined, 0);
END;
$$;

-- ==========================================================================
-- 5. Rollback
-- ==========================================================================
-- NOTE: Enum values cannot be removed in Postgres. To rollback, the
-- 'upcoming' value would remain but be unused.
-- Restore original RPCs from 00008_passes.sql and 20260422185101.
