-- ============================================================================
-- Migration: 00007_bookings
-- Description: Recurring rules, bookings with overlap prevention, and
--              availability functions
-- ============================================================================

-- ==========================================================================
-- 1. Tables
-- ==========================================================================

-- 1a. recurring_rules (must precede bookings due to FK)
CREATE TABLE recurring_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  resource_id   uuid NOT NULL REFERENCES resources(id),
  pattern       recurrence_pattern NOT NULL,
  day_of_week   integer,
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 1b. bookings
CREATE TABLE bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id          uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id),
  resource_id       uuid NOT NULL REFERENCES resources(id),
  -- Time
  start_time        timestamptz NOT NULL,
  end_time          timestamptz NOT NULL,
  -- Status
  status            booking_status NOT NULL DEFAULT 'confirmed',
  -- Check-in/out tracking
  checked_in_at     timestamptz,
  checked_out_at    timestamptz,
  -- Payment (pay-per-use bookings)
  stripe_session_id text,
  amount_cents      integer,
  -- Credits
  duration_minutes  integer,
  credit_type_id    uuid REFERENCES resource_types(id),
  credits_deducted  integer DEFAULT 0,
  -- Recurrence
  recurring_rule_id uuid REFERENCES recurring_rules(id),
  -- Cancellation
  cancelled_at      timestamptz,
  cancel_reason     text,
  -- Reminders
  reminded_at       timestamptz,
  -- Metadata
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  -- Prevent double-booking (btree_gist)
  CONSTRAINT no_overlap EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status NOT IN ('cancelled'))
);

-- ==========================================================================
-- 2. Database functions
-- ==========================================================================

-- 2a. get_desk_availability
-- Returns total, booked, and available desk counts for a given date.
-- Reads timezone from spaces table. Checks space_closures (created in 00011).
CREATE FUNCTION get_desk_availability(p_space_id uuid, p_date date)
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

  RETURN QUERY SELECT v_total, v_booked, (v_total - v_booked);
END;
$$;

-- 2b. get_room_availability
-- Returns hourly slots for a specific room on a given date, with availability.
-- Reads business hours and timezone from spaces table.
-- Checks space_closures (created in 00011).
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

  -- Generate hourly slots within business hours
  v_cursor_start := (p_date || ' ' || v_open_time::text)::timestamp
                    AT TIME ZONE v_timezone;

  WHILE v_cursor_start < (p_date || ' ' || v_close_time::text)::timestamp
                          AT TIME ZONE v_timezone LOOP
    v_cursor_end := v_cursor_start + interval '1 hour';

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
-- 3. RLS policies
-- ==========================================================================

-- 3a. recurring_rules
ALTER TABLE recurring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON recurring_rules
  FOR SELECT USING (
    user_id = auth.uid()
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON recurring_rules
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON recurring_rules
  FOR ALL USING (is_platform_admin(auth.uid()));

-- 3b. bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON bookings
  FOR SELECT USING (
    user_id = auth.uid()
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON bookings
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON bookings
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 4. Indexes
-- ==========================================================================

CREATE INDEX idx_recurring_rules_space_id    ON recurring_rules(space_id);
CREATE INDEX idx_recurring_rules_user_id     ON recurring_rules(user_id);
CREATE INDEX idx_recurring_rules_resource_id ON recurring_rules(resource_id);

CREATE INDEX idx_bookings_space_id    ON bookings(space_id);
CREATE INDEX idx_bookings_user_id     ON bookings(user_id);
CREATE INDEX idx_bookings_resource_id ON bookings(resource_id);
CREATE INDEX idx_bookings_status      ON bookings(space_id, status);
CREATE INDEX idx_bookings_time_range  ON bookings(space_id, start_time, end_time);

-- ==========================================================================
-- 5. updated_at triggers
-- ==========================================================================

CREATE TRIGGER set_recurring_rules_updated_at
  BEFORE UPDATE ON recurring_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 6. Rollback
-- ==========================================================================
-- DROP TRIGGER IF EXISTS set_bookings_updated_at ON bookings;
-- DROP TRIGGER IF EXISTS set_recurring_rules_updated_at ON recurring_rules;
-- DROP POLICY IF EXISTS "platform_admins_full" ON bookings;
-- DROP POLICY IF EXISTS "space_admins_manage" ON bookings;
-- DROP POLICY IF EXISTS "users_read_own" ON bookings;
-- DROP POLICY IF EXISTS "platform_admins_full" ON recurring_rules;
-- DROP POLICY IF EXISTS "space_admins_manage" ON recurring_rules;
-- DROP POLICY IF EXISTS "users_read_own" ON recurring_rules;
-- DROP FUNCTION IF EXISTS get_room_availability(uuid, uuid, date);
-- DROP FUNCTION IF EXISTS get_desk_availability(uuid, date);
-- DROP TABLE IF EXISTS bookings;
-- DROP TABLE IF EXISTS recurring_rules;
