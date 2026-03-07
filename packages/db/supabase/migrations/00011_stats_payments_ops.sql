-- ============================================================================
-- Migration: 00011_stats_payments_ops
-- Description: Stats, payment events, closures, notifications, waitlist,
--              and notification preferences
-- ============================================================================

-- ==========================================================================
-- 1. Tables
-- ==========================================================================

-- 1a. monthly_stats
CREATE TABLE monthly_stats (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id               uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  month                  date NOT NULL,
  total_members          integer,
  members_by_plan        jsonb,
  new_members            integer,
  churned_members        integer,
  mrr_cents              integer,
  variable_revenue_cents integer,
  total_revenue_cents    integer,
  avg_desk_occupancy     numeric,
  avg_room_utilisation   numeric,
  peak_hour              integer,
  day_passes_sold        integer,
  week_passes_sold       integer,
  leads_created          integer,
  leads_converted        integer,
  generated_at           timestamptz DEFAULT now(),
  UNIQUE(space_id, month)
);

-- 1b. daily_stats
CREATE TABLE daily_stats (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id       uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  date           date NOT NULL,
  desk_occupancy numeric,
  room_bookings  integer,
  active_passes  integer,
  check_ins      integer,
  check_outs     integer,
  generated_at   timestamptz DEFAULT now(),
  UNIQUE(space_id, date)
);

-- 1c. payment_events
CREATE TABLE payment_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id           uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  stripe_event_id    text NOT NULL UNIQUE,
  event_type         text NOT NULL,
  stripe_customer_id text,
  stripe_account_id  text,
  user_id            uuid REFERENCES auth.users(id),
  payload            jsonb NOT NULL,
  processed          boolean DEFAULT false,
  error              text,
  created_at         timestamptz DEFAULT now()
);

-- 1d. space_closures
CREATE TABLE space_closures (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id   uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  date       date NOT NULL,
  reason     text,
  all_day    boolean DEFAULT true,
  start_time time,
  end_time   time,
  created_at timestamptz DEFAULT now(),
  UNIQUE(space_id, date)
);

-- 1e. notifications_log
CREATE TABLE notifications_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id     uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id),
  channel      text NOT NULL CHECK (channel IN ('email', 'push', 'sms')),
  template     text NOT NULL,
  recipient    text NOT NULL,
  subject      text,
  metadata     jsonb DEFAULT '{}',
  sent_at      timestamptz DEFAULT now(),
  error        text
);

-- 1f. waitlist
CREATE TABLE waitlist (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  resource_id   uuid NOT NULL REFERENCES resources(id),
  desired_date  date NOT NULL,
  desired_start time,
  desired_end   time,
  status        text NOT NULL DEFAULT 'waiting'
                CHECK (status IN ('waiting', 'notified', 'booked', 'expired')),
  notified_at   timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz DEFAULT now()
);

-- 1g. notification_preferences
CREATE TABLE notification_preferences (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id                uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id                 uuid NOT NULL REFERENCES auth.users(id),
  booking_reminders       boolean DEFAULT true,
  credit_warnings         boolean DEFAULT true,
  marketing               boolean DEFAULT false,
  weekly_summary          boolean DEFAULT true,
  preferred_channel       text DEFAULT 'email'
                          CHECK (preferred_channel IN ('email', 'push', 'sms')),
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),
  UNIQUE(space_id, user_id)
);

-- ==========================================================================
-- 2. RLS policies
-- ==========================================================================

-- 2a. monthly_stats (admin-only)
ALTER TABLE monthly_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "space_admins_manage" ON monthly_stats
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON monthly_stats
  FOR ALL USING (is_platform_admin(auth.uid()));

-- 2b. daily_stats (admin-only)
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "space_admins_manage" ON daily_stats
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON daily_stats
  FOR ALL USING (is_platform_admin(auth.uid()));

-- 2c. payment_events (admin-only)
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "space_admins_manage" ON payment_events
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON payment_events
  FOR ALL USING (is_platform_admin(auth.uid()));

-- 2d. space_closures (public read within space, admin manage)
ALTER TABLE space_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON space_closures
  FOR SELECT USING (
    space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON space_closures
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON space_closures
  FOR ALL USING (is_platform_admin(auth.uid()));

-- 2e. notifications_log (admin-only)
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "space_admins_manage" ON notifications_log
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON notifications_log
  FOR ALL USING (is_platform_admin(auth.uid()));

-- 2f. waitlist
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON waitlist
  FOR SELECT USING (
    user_id = auth.uid()
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON waitlist
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON waitlist
  FOR ALL USING (is_platform_admin(auth.uid()));

-- 2g. notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON notification_preferences
  FOR SELECT USING (
    user_id = auth.uid()
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "users_update_own" ON notification_preferences
  FOR UPDATE USING (
    user_id = auth.uid()
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON notification_preferences
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON notification_preferences
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 3. Indexes
-- ==========================================================================

-- payment_events
CREATE INDEX idx_payment_events_space_id    ON payment_events(space_id);
CREATE INDEX idx_payment_events_event_type  ON payment_events(space_id, event_type);
CREATE INDEX idx_payment_events_user_id     ON payment_events(user_id) WHERE user_id IS NOT NULL;

-- space_closures
CREATE INDEX idx_space_closures_space_date  ON space_closures(space_id, date);

-- notifications_log
CREATE INDEX idx_notifications_log_space_id ON notifications_log(space_id);
CREATE INDEX idx_notifications_log_user_id  ON notifications_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_notifications_log_template ON notifications_log(space_id, template, recipient);

-- waitlist
CREATE INDEX idx_waitlist_space_id     ON waitlist(space_id);
CREATE INDEX idx_waitlist_resource     ON waitlist(resource_id, desired_date);
CREATE INDEX idx_waitlist_user_id      ON waitlist(user_id);

-- ==========================================================================
-- 4. updated_at triggers
-- ==========================================================================

-- Only notification_preferences has updated_at among these tables
CREATE TRIGGER set_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 5. Rollback
-- ==========================================================================
-- DROP TRIGGER IF EXISTS set_notification_preferences_updated_at ON notification_preferences;
-- DROP POLICY IF EXISTS "platform_admins_full" ON notification_preferences;
-- DROP POLICY IF EXISTS "space_admins_manage" ON notification_preferences;
-- DROP POLICY IF EXISTS "users_update_own" ON notification_preferences;
-- DROP POLICY IF EXISTS "users_read_own" ON notification_preferences;
-- DROP POLICY IF EXISTS "platform_admins_full" ON waitlist;
-- DROP POLICY IF EXISTS "space_admins_manage" ON waitlist;
-- DROP POLICY IF EXISTS "users_read_own" ON waitlist;
-- DROP POLICY IF EXISTS "platform_admins_full" ON notifications_log;
-- DROP POLICY IF EXISTS "space_admins_manage" ON notifications_log;
-- DROP POLICY IF EXISTS "platform_admins_full" ON space_closures;
-- DROP POLICY IF EXISTS "space_admins_manage" ON space_closures;
-- DROP POLICY IF EXISTS "public_read" ON space_closures;
-- DROP POLICY IF EXISTS "platform_admins_full" ON payment_events;
-- DROP POLICY IF EXISTS "space_admins_manage" ON payment_events;
-- DROP POLICY IF EXISTS "platform_admins_full" ON daily_stats;
-- DROP POLICY IF EXISTS "space_admins_manage" ON daily_stats;
-- DROP POLICY IF EXISTS "platform_admins_full" ON monthly_stats;
-- DROP POLICY IF EXISTS "space_admins_manage" ON monthly_stats;
-- DROP TABLE IF EXISTS notification_preferences;
-- DROP TABLE IF EXISTS waitlist;
-- DROP TABLE IF EXISTS notifications_log;
-- DROP TABLE IF EXISTS space_closures;
-- DROP TABLE IF EXISTS payment_events;
-- DROP TABLE IF EXISTS daily_stats;
-- DROP TABLE IF EXISTS monthly_stats;
