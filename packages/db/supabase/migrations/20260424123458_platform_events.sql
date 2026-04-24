-- Platform Events Infrastructure
--
-- Append-only event log for tenant-visible activity tracking and admin
-- oversight. Events are product data shown in UI, not debug logs.
--
-- Rollback:
--   DROP TABLE IF EXISTS platform_events;
--   DROP TABLE IF EXISTS event_types;

-- ── Event catalog ───────────────────────────────────────────────
-- Add new event types as seed rows, not migrations.

CREATE TABLE event_types (
  slug text PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('member', 'admin', 'system', 'billing', 'auth')),
  description text NOT NULL,
  is_tenant_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE event_types IS
  'Catalog of all event types. Add new rows instead of code changes. is_tenant_visible=false hides from non-admin members.';

-- ── Events table ────────────────────────────────────────────────

CREATE TABLE platform_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('member', 'admin', 'system', 'stripe')),
  event_type text NOT NULL REFERENCES event_types(slug),
  resource_type text,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform_events IS
  'Append-only event log. Never update or delete rows except via retention jobs.';

-- ── Indexes ─────────────────────────────────────────────────────

CREATE INDEX platform_events_space_created_idx
  ON platform_events (space_id, created_at DESC);

CREATE INDEX platform_events_space_actor_created_idx
  ON platform_events (space_id, actor_id, created_at DESC);

CREATE INDEX platform_events_space_type_created_idx
  ON platform_events (space_id, event_type, created_at DESC);

CREATE INDEX platform_events_space_resource_idx
  ON platform_events (space_id, resource_type, resource_id)
  WHERE resource_type IS NOT NULL;

-- ── RLS ─────────────────────────────────────────────────────────

ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;

-- event_types: readable by all authenticated users (needed for joins)
CREATE POLICY event_types_read ON event_types
  FOR SELECT TO authenticated
  USING (true);

-- platform_events: members see their own tenant-visible events
CREATE POLICY platform_events_member_read ON platform_events
  FOR SELECT TO authenticated
  USING (
    space_id = current_space_id()
    AND actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM event_types et
      WHERE et.slug = platform_events.event_type
        AND et.is_tenant_visible = true
    )
  );

-- platform_events: space admins/owners see everything in their space
CREATE POLICY platform_events_admin_read ON platform_events
  FOR SELECT TO authenticated
  USING (
    space_id = current_space_id()
    AND current_space_role() IN ('admin', 'owner')
  );

-- platform_events: platform admins see all events
CREATE POLICY platform_events_platform_admin ON platform_events
  FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));

-- No insert/update/delete policies. Writes happen via service role only.
-- Table is append-only.

-- ── Seed event types ────────────────────────────────────────────

INSERT INTO event_types (slug, category, description, is_tenant_visible) VALUES
  -- Auth
  ('member.signed_in',        'auth',    'Member signed in',                   true),
  ('member.signed_out',       'auth',    'Member signed out',                  true),
  ('member.invited',          'admin',   'Admin invited a new member',         false),
  ('member.joined',           'auth',    'New member completed onboarding',    true),
  -- Access
  ('member.checked_in',       'member',  'Member checked into the space',      true),
  ('member.checked_out',      'member',  'Member checked out of the space',    true),
  -- Bookings
  ('booking.created',         'member',  'Booking created',                    true),
  ('booking.cancelled',       'member',  'Booking cancelled',                  true),
  ('booking.modified',        'member',  'Booking modified',                   true),
  -- Billing
  ('billing.subscription_created',   'billing', 'Subscription created',        true),
  ('billing.subscription_updated',   'billing', 'Subscription updated',        true),
  ('billing.subscription_cancelled', 'billing', 'Subscription cancelled',      true),
  ('billing.payment_succeeded',      'billing', 'Payment succeeded',           true),
  ('billing.payment_failed',         'billing', 'Payment failed',              true),
  -- Admin actions (not tenant visible)
  ('admin.plan_changed',      'admin',   'Admin changed member plan',          false),
  ('admin.member_removed',    'admin',   'Admin removed a member',             false),
  ('admin.settings_updated',  'admin',   'Admin updated space settings',       false)
ON CONFLICT (slug) DO NOTHING;
