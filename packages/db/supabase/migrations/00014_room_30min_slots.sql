-- ============================================================================
-- Migration: 00014_room_30min_slots
-- Description: Update get_room_availability to return 30-minute slots
--              instead of 1-hour slots (required for booking UI granularity)
-- ============================================================================

-- Drop and recreate to change the loop interval
DROP FUNCTION IF EXISTS get_room_availability(uuid, uuid, date);

CREATE FUNCTION get_room_availability(
  p_space_id    uuid,
  p_resource_id uuid,
  p_date        date
)
RETURNS TABLE(slot_start timestamptz, slot_end timestamptz, is_available boolean)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_timezone       text;
  v_business_hours jsonb;
  v_day_name       text;
  v_day_hours      jsonb;
  v_open_time      time;
  v_close_time     time;
  v_cursor_start   timestamptz;
  v_cursor_end     timestamptz;
  v_is_closed      boolean;
BEGIN
  PERFORM verify_space_access(p_space_id);

  -- Get space timezone and business hours
  SELECT s.timezone, s.business_hours
  INTO v_timezone, v_business_hours
  FROM spaces s WHERE s.id = p_space_id;

  -- Check if space is closed on this date
  SELECT EXISTS (
    SELECT 1 FROM space_closures sc
    WHERE sc.space_id = p_space_id
      AND sc.date = p_date
      AND sc.all_day = true
  ) INTO v_is_closed;

  IF v_is_closed THEN
    RETURN;
  END IF;

  -- Map date to business_hours key (mon, tue, wed, ...)
  v_day_name := lower(to_char(p_date, 'dy'));
  v_day_hours := v_business_hours -> v_day_name;

  -- Closed day (null in business_hours)
  IF v_day_hours IS NULL OR v_day_hours = 'null'::jsonb THEN
    RETURN;
  END IF;

  v_open_time  := (v_day_hours ->> 'open')::time;
  v_close_time := (v_day_hours ->> 'close')::time;

  -- Generate 30-minute slots within business hours
  v_cursor_start := (p_date || ' ' || v_open_time::text)::timestamp
                    AT TIME ZONE v_timezone;

  WHILE v_cursor_start < (p_date || ' ' || v_close_time::text)::timestamp
                          AT TIME ZONE v_timezone LOOP
    v_cursor_end := v_cursor_start + interval '30 minutes';

    RETURN QUERY
    SELECT
      v_cursor_start,
      v_cursor_end,
      NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.resource_id = p_resource_id
          AND b.space_id    = p_space_id
          AND b.status NOT IN ('cancelled')
          AND b.start_time  < v_cursor_end
          AND b.end_time    > v_cursor_start
      );

    v_cursor_start := v_cursor_end;
  END LOOP;
END;
$$;

-- ==========================================================================
-- Rollback
-- ==========================================================================
-- DROP FUNCTION IF EXISTS get_room_availability(uuid, uuid, date);
-- Then re-run the original 00007_bookings.sql version (1-hour slots)
