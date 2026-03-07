-- ============================================================================
-- Migration: 00008_passes
-- Description: Day/week passes with auto-assign desk and activation function
-- ============================================================================

-- ==========================================================================
-- 1. Tables
-- ==========================================================================

CREATE TABLE passes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id          uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id),
  pass_type         pass_type NOT NULL,
  status            pass_status NOT NULL DEFAULT 'pending_payment',
  -- Dates
  start_date        date NOT NULL,
  end_date          date NOT NULL,
  -- Desk
  assigned_desk_id  uuid REFERENCES resources(id),
  -- Payment
  stripe_session_id text,
  amount_cents      integer NOT NULL,
  -- Guest
  is_guest          boolean NOT NULL DEFAULT false,
  purchased_by      uuid REFERENCES auth.users(id),
  -- Metadata
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ==========================================================================
-- 2. Database functions
-- ==========================================================================

-- 2a. auto_assign_desk
-- Finds the first available desk for a pass date range within a space.
CREATE FUNCTION auto_assign_desk(
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
  v_desk_id uuid;
  v_timezone text;
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
    -- No overlapping active passes
    AND r.id NOT IN (
      SELECT p.assigned_desk_id FROM passes p
      WHERE p.space_id = p_space_id
        AND p.assigned_desk_id IS NOT NULL
        AND p.status IN ('active')
        AND p.start_date <= p_end_date
        AND p.end_date   >= p_start_date
    )
  ORDER BY r.sort_order, r.name
  LIMIT 1;

  RETURN v_desk_id;
END;
$$;

-- 2b. activate_pass
-- Activates a pass after successful Stripe payment, auto-assigns a desk.
CREATE FUNCTION activate_pass(
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

  -- Auto-assign a desk
  v_desk_id := auto_assign_desk(p_space_id, v_start, v_end);

  -- Activate the pass
  UPDATE passes
  SET status           = 'active',
      assigned_desk_id = v_desk_id,
      updated_at       = now()
  WHERE id = v_pass_id;

  RETURN v_pass_id;
END;
$$;

-- ==========================================================================
-- 3. RLS policies
-- ==========================================================================

ALTER TABLE passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON passes
  FOR SELECT USING (
    user_id = auth.uid()
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON passes
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON passes
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 4. Indexes
-- ==========================================================================

CREATE INDEX idx_passes_space_id  ON passes(space_id);
CREATE INDEX idx_passes_user_id   ON passes(user_id);
CREATE INDEX idx_passes_status    ON passes(space_id, status);
CREATE INDEX idx_passes_dates     ON passes(space_id, start_date, end_date);

-- ==========================================================================
-- 5. updated_at triggers
-- ==========================================================================

CREATE TRIGGER set_passes_updated_at
  BEFORE UPDATE ON passes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 6. Rollback
-- ==========================================================================
-- DROP TRIGGER IF EXISTS set_passes_updated_at ON passes;
-- DROP POLICY IF EXISTS "platform_admins_full" ON passes;
-- DROP POLICY IF EXISTS "space_admins_manage" ON passes;
-- DROP POLICY IF EXISTS "users_read_own" ON passes;
-- DROP FUNCTION IF EXISTS activate_pass(uuid, uuid, text);
-- DROP FUNCTION IF EXISTS auto_assign_desk(uuid, date, date);
-- DROP TABLE IF EXISTS passes;
