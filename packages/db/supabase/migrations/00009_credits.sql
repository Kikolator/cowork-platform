-- ============================================================================
-- Migration: 00009_credits
-- Description: Credit grants, booking deductions, and credit management
--              functions (grant, balance, booking, cancel, expire)
-- ============================================================================

-- ==========================================================================
-- 1. Tables
-- ==========================================================================

-- 1a. credit_grants
CREATE TABLE credit_grants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id            uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type_id    uuid NOT NULL REFERENCES resource_types(id),
  source              credit_grant_source NOT NULL,
  amount_minutes      integer NOT NULL CHECK (amount_minutes > 0),
  used_minutes        integer NOT NULL DEFAULT 0 CHECK (used_minutes >= 0),
  valid_from          timestamptz NOT NULL DEFAULT now(),
  valid_until         timestamptz,
  stripe_invoice_id   text,
  stripe_line_item_id text,
  metadata            jsonb DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT used_not_exceeding_amount CHECK (used_minutes <= amount_minutes),
  CONSTRAINT valid_range CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

-- Idempotency indexes (prevent duplicate webhook grants)
CREATE UNIQUE INDEX idx_credit_grants_invoice_unique
  ON credit_grants(stripe_invoice_id, resource_type_id, user_id)
  WHERE stripe_invoice_id IS NOT NULL;

CREATE UNIQUE INDEX idx_credit_grants_line_item_unique
  ON credit_grants(stripe_line_item_id, resource_type_id, user_id)
  WHERE stripe_line_item_id IS NOT NULL;

-- 1b. booking_credit_deductions
CREATE TABLE booking_credit_deductions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  grant_id    uuid NOT NULL REFERENCES credit_grants(id),
  minutes     integer NOT NULL CHECK (minutes > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ==========================================================================
-- 2. Database functions
-- ==========================================================================

-- 2a. get_credit_balance
-- Returns remaining minutes per resource type for a user in a space.
CREATE FUNCTION get_credit_balance(
  p_space_id uuid,
  p_user_id  uuid
)
RETURNS TABLE(resource_type_id uuid, total_minutes integer, used_minutes integer, remaining_minutes integer, is_unlimited boolean)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM verify_space_access(p_space_id);

  RETURN QUERY
  -- Check for unlimited via plan_credit_config first
  SELECT
    rt.id AS resource_type_id,
    CASE WHEN pcc.is_unlimited THEN 0 ELSE coalesce(g.total, 0) END AS total_minutes,
    CASE WHEN pcc.is_unlimited THEN 0 ELSE coalesce(g.used, 0) END AS used_minutes,
    CASE WHEN pcc.is_unlimited THEN 2147483647 ELSE coalesce(g.total, 0) - coalesce(g.used, 0) END AS remaining_minutes,
    coalesce(pcc.is_unlimited, false) AS is_unlimited
  FROM resource_types rt
  -- Check unlimited status from member's plan
  LEFT JOIN LATERAL (
    SELECT pc.is_unlimited
    FROM members m
    JOIN plan_credit_config pc ON pc.plan_id = m.plan_id
      AND pc.resource_type_id = rt.id
    WHERE m.space_id = p_space_id
      AND m.user_id = p_user_id
      AND m.status = 'active'
    LIMIT 1
  ) pcc ON true
  -- Aggregate grant balances
  LEFT JOIN LATERAL (
    SELECT
      sum(cg.amount_minutes)::integer AS total,
      sum(cg.used_minutes)::integer AS used
    FROM credit_grants cg
    WHERE cg.space_id = p_space_id
      AND cg.user_id = p_user_id
      AND cg.resource_type_id = rt.id
      AND cg.valid_from <= now()
      AND (cg.valid_until IS NULL OR cg.valid_until > now())
      AND cg.used_minutes < cg.amount_minutes
  ) g ON true
  WHERE rt.space_id = p_space_id
    AND (g.total IS NOT NULL OR pcc.is_unlimited = true);
END;
$$;

-- 2b. grant_credits
-- Creates a credit grant with Stripe idempotency.
CREATE FUNCTION grant_credits(
  p_space_id          uuid,
  p_user_id           uuid,
  p_resource_type_id  uuid,
  p_source            credit_grant_source,
  p_amount_minutes    integer,
  p_valid_from        timestamptz DEFAULT now(),
  p_valid_until       timestamptz DEFAULT NULL,
  p_stripe_invoice_id text DEFAULT NULL,
  p_stripe_line_item_id text DEFAULT NULL,
  p_metadata          jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant_id uuid;
BEGIN
  PERFORM verify_space_access(p_space_id);

  INSERT INTO credit_grants (
    space_id, user_id, resource_type_id, source,
    amount_minutes, valid_from, valid_until,
    stripe_invoice_id, stripe_line_item_id, metadata
  ) VALUES (
    p_space_id, p_user_id, p_resource_type_id, p_source,
    p_amount_minutes, p_valid_from, p_valid_until,
    p_stripe_invoice_id, p_stripe_line_item_id, p_metadata
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_grant_id;

  -- If ON CONFLICT hit, find the existing grant
  IF v_grant_id IS NULL AND p_stripe_invoice_id IS NOT NULL THEN
    SELECT cg.id INTO v_grant_id
    FROM credit_grants cg
    WHERE cg.stripe_invoice_id = p_stripe_invoice_id
      AND cg.resource_type_id = p_resource_type_id
      AND cg.user_id = p_user_id;
  END IF;

  IF v_grant_id IS NULL AND p_stripe_line_item_id IS NOT NULL THEN
    SELECT cg.id INTO v_grant_id
    FROM credit_grants cg
    WHERE cg.stripe_line_item_id = p_stripe_line_item_id
      AND cg.resource_type_id = p_resource_type_id
      AND cg.user_id = p_user_id;
  END IF;

  RETURN v_grant_id;
END;
$$;

-- 2c. create_booking_with_credits
-- Creates a booking and deducts credits (expiring first, then purchased).
CREATE FUNCTION create_booking_with_credits(
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
BEGIN
  PERFORM verify_space_access(p_space_id);

  -- Get resource type
  SELECT r.resource_type_id INTO v_resource_type_id
  FROM resources r
  WHERE r.id = p_resource_id
    AND r.space_id = p_space_id;

  IF v_resource_type_id IS NULL THEN
    RAISE EXCEPTION 'Resource not found in this space'
      USING ERRCODE = 'P0002';
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

-- 2d. cancel_booking_refund_credits
-- Cancels a booking and refunds credits back to their original grants.
CREATE FUNCTION cancel_booking_refund_credits(
  p_space_id   uuid,
  p_booking_id uuid,
  p_user_id    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deduction record;
BEGIN
  PERFORM verify_space_access(p_space_id);

  -- Verify booking belongs to this user and space
  IF NOT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = p_booking_id
      AND b.space_id = p_space_id
      AND b.user_id = p_user_id
      AND b.status NOT IN ('cancelled')
  ) THEN
    RAISE EXCEPTION 'Booking not found or already cancelled'
      USING ERRCODE = 'P0002';
  END IF;

  -- Cancel the booking
  UPDATE bookings
  SET status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  WHERE id = p_booking_id;

  -- Refund credits back to original grants
  FOR v_deduction IN
    SELECT bcd.grant_id, bcd.minutes
    FROM booking_credit_deductions bcd
    WHERE bcd.booking_id = p_booking_id
  LOOP
    UPDATE credit_grants
    SET used_minutes = used_minutes - v_deduction.minutes,
        updated_at = now()
    WHERE id = v_deduction.grant_id;
  END LOOP;
END;
$$;

-- 2e. expire_renewable_credits
-- Expires subscription-sourced credits that have passed their valid_until date.
CREATE FUNCTION expire_renewable_credits(
  p_space_id uuid,
  p_user_id  uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count integer;
BEGIN
  PERFORM verify_space_access(p_space_id);

  WITH expired AS (
    UPDATE credit_grants
    SET used_minutes = amount_minutes,
        updated_at = now()
    WHERE space_id = p_space_id
      AND user_id = p_user_id
      AND source = 'subscription'
      AND valid_until IS NOT NULL
      AND valid_until < now()
      AND used_minutes < amount_minutes
    RETURNING id
  )
  SELECT count(*)::integer INTO v_expired_count FROM expired;

  RETURN v_expired_count;
END;
$$;

-- ==========================================================================
-- 3. RLS policies
-- ==========================================================================

-- 3a. credit_grants
ALTER TABLE credit_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON credit_grants
  FOR SELECT USING (
    user_id = auth.uid()
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON credit_grants
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON credit_grants
  FOR ALL USING (is_platform_admin(auth.uid()));

-- 3b. booking_credit_deductions
ALTER TABLE booking_credit_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON booking_credit_deductions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_credit_deductions.booking_id
        AND b.user_id = auth.uid()
        AND b.space_id = (auth.jwt() ->> 'space_id')::uuid
    )
  );

CREATE POLICY "space_admins_manage" ON booking_credit_deductions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_credit_deductions.booking_id
        AND b.space_id = (auth.jwt() ->> 'space_id')::uuid
        AND is_space_admin(auth.uid(), b.space_id)
    )
  );

CREATE POLICY "platform_admins_full" ON booking_credit_deductions
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 4. Indexes
-- ==========================================================================

CREATE INDEX idx_credit_grants_space_id          ON credit_grants(space_id);
CREATE INDEX idx_credit_grants_user_id           ON credit_grants(user_id);
CREATE INDEX idx_credit_grants_resource_type_id  ON credit_grants(resource_type_id);
CREATE INDEX idx_credit_grants_valid_range       ON credit_grants(space_id, user_id, resource_type_id)
  WHERE used_minutes < amount_minutes;

CREATE INDEX idx_booking_credit_deductions_booking_id ON booking_credit_deductions(booking_id);
CREATE INDEX idx_booking_credit_deductions_grant_id   ON booking_credit_deductions(grant_id);

-- ==========================================================================
-- 5. updated_at triggers
-- ==========================================================================

CREATE TRIGGER set_credit_grants_updated_at
  BEFORE UPDATE ON credit_grants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- No trigger on booking_credit_deductions — no updated_at column

-- ==========================================================================
-- 6. Rollback
-- ==========================================================================
-- DROP TRIGGER IF EXISTS set_credit_grants_updated_at ON credit_grants;
-- DROP POLICY IF EXISTS "platform_admins_full" ON booking_credit_deductions;
-- DROP POLICY IF EXISTS "space_admins_manage" ON booking_credit_deductions;
-- DROP POLICY IF EXISTS "users_read_own" ON booking_credit_deductions;
-- DROP POLICY IF EXISTS "platform_admins_full" ON credit_grants;
-- DROP POLICY IF EXISTS "space_admins_manage" ON credit_grants;
-- DROP POLICY IF EXISTS "users_read_own" ON credit_grants;
-- DROP FUNCTION IF EXISTS expire_renewable_credits(uuid, uuid);
-- DROP FUNCTION IF EXISTS cancel_booking_refund_credits(uuid, uuid, uuid);
-- DROP FUNCTION IF EXISTS create_booking_with_credits(uuid, uuid, uuid, timestamptz, timestamptz);
-- DROP FUNCTION IF EXISTS grant_credits(uuid, uuid, uuid, credit_grant_source, integer, timestamptz, timestamptz, text, text, jsonb);
-- DROP FUNCTION IF EXISTS get_credit_balance(uuid, uuid);
-- DROP TABLE IF EXISTS booking_credit_deductions;
-- DROP TABLE IF EXISTS credit_grants;
