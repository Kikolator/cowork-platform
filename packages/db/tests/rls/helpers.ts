/**
 * RLS Test Helpers
 *
 * Provides JWT generation, Supabase client factories, and test data seeding
 * for testing Row Level Security policies against a local Supabase instance.
 *
 * NOTE: This file uses execSync/execFileSync to run psql against a local dev
 * database. All SQL is hardcoded test data -- no user input is involved.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { execFileSync } from 'child_process';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SUPABASE_URL = 'http://127.0.0.1:54321';
export const SERVICE_ROLE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';
export const JWT_SECRET =
  'super-secret-jwt-token-with-at-least-32-characters-long';

// Seed data IDs
export const TENANT_ID = '11111111-1111-1111-1111-111111111111';
export const SPACE_A_ID = '22222222-2222-2222-2222-222222222222';

// Second space / tenant for cross-tenant tests
export const TENANT_B_ID = '33333333-3333-3333-3333-333333333333';
export const SPACE_B_ID = '44444444-4444-4444-4444-444444444444';

// Deterministic user UUIDs
export const PLATFORM_ADMIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const SPACE_A_ADMIN_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const SPACE_A_MEMBER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
export const SPACE_B_ADMIN_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
export const SPACE_B_MEMBER_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
export const UNRELATED_USER_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

interface JwtClaims {
  sub: string;
  role?: string;
  app_metadata?: Record<string, unknown>;
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
}

/**
 * Create a signed JWT for role impersonation.
 */
export function signJwt(claims: JwtClaims): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: claims.aud ?? 'authenticated',
    iss: claims.iss ?? 'http://127.0.0.1:54321/auth/v1',
    sub: claims.sub,
    role: claims.role ?? 'authenticated',
    iat: claims.iat ?? now,
    exp: claims.exp ?? now + 3600,
    app_metadata: claims.app_metadata ?? {},
    user_metadata: {},
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------

/** Service role client -- bypasses RLS. Used for seeding/cleanup. */
export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/** Anon client -- no auth token at all, uses anon role. */
export function anonClient(): SupabaseClient {
  // Use the service role key as the project key but override the Authorization
  // header so PostgREST treats the request as the `anon` role.
  const anonJwt = jwt.sign(
    {
      aud: 'authenticated',
      iss: 'http://127.0.0.1:54321/auth/v1',
      role: 'anon',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    JWT_SECRET,
    { algorithm: 'HS256' }
  );
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${anonJwt}`,
      },
    },
  });
}

/**
 * Create a client that impersonates a specific user with specific app_metadata.
 */
export function userClient(userId: string, spaceId?: string): SupabaseClient {
  const token = signJwt({
    sub: userId,
    role: 'authenticated',
    app_metadata: spaceId ? { space_id: spaceId } : {},
  });
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// SQL helper via psql (for seeding/cleanup)
// ---------------------------------------------------------------------------

function findPsql(): string {
  try {
    return execFileSync('/usr/bin/which', ['psql'], {
      encoding: 'utf-8',
    }).trim();
  } catch {
    return '/opt/homebrew/opt/libpq/bin/psql';
  }
}

const PSQL = findPsql();
const PG_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/**
 * Run multi-statement SQL via psql stdin (bypasses RLS entirely).
 * Only used with hardcoded test SQL -- never with user input.
 */
export function psqlMulti(sql: string): string {
  return execFileSync(PSQL, [PG_URL], {
    input: sql,
    encoding: 'utf-8',
    timeout: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Test data seeding
// ---------------------------------------------------------------------------

/**
 * Seeds all test data needed for RLS tests:
 * - Second tenant + space
 * - Auth users for all roles
 * - space_users entries
 * - platform_admins entry
 * - Resource types, plans, resources, members (for FK-dependent tables)
 */
export function seedTestData(): void {
  const sql = `
    -- =====================================================================
    -- Auth users (trigger auto-creates shared_profiles)
    -- =====================================================================
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, confirmation_token
    )
    VALUES
      ('${PLATFORM_ADMIN_ID}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'platform-admin@test.com', crypt('password123', gen_salt('bf')),
       now(), now(), now(), '{}', '{}', ''),
      ('${SPACE_A_ADMIN_ID}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'space-a-admin@test.com', crypt('password123', gen_salt('bf')),
       now(), now(), now(), '{}', '{}', ''),
      ('${SPACE_A_MEMBER_ID}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'space-a-member@test.com', crypt('password123', gen_salt('bf')),
       now(), now(), now(), '{}', '{}', ''),
      ('${SPACE_B_ADMIN_ID}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'space-b-admin@test.com', crypt('password123', gen_salt('bf')),
       now(), now(), now(), '{}', '{}', ''),
      ('${SPACE_B_MEMBER_ID}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'space-b-member@test.com', crypt('password123', gen_salt('bf')),
       now(), now(), now(), '{}', '{}', ''),
      ('${UNRELATED_USER_ID}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'unrelated@test.com', crypt('password123', gen_salt('bf')),
       now(), now(), now(), '{}', '{}', '')
    ON CONFLICT (id) DO NOTHING;

    -- =====================================================================
    -- Second tenant + space
    -- =====================================================================
    INSERT INTO tenants (id, name, slug, status)
    VALUES ('${TENANT_B_ID}', 'Tenant B', 'tenant-b', 'active')
    ON CONFLICT (slug) DO NOTHING;

    INSERT INTO spaces (id, tenant_id, name, slug, active)
    VALUES ('${SPACE_B_ID}', '${TENANT_B_ID}', 'Space B', 'space-b', true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;

    -- =====================================================================
    -- Platform admin
    -- =====================================================================
    INSERT INTO platform_admins (user_id)
    VALUES ('${PLATFORM_ADMIN_ID}')
    ON CONFLICT (user_id) DO NOTHING;

    -- =====================================================================
    -- Space users
    -- =====================================================================
    INSERT INTO space_users (user_id, space_id, role)
    VALUES
      ('${SPACE_A_ADMIN_ID}', '${SPACE_A_ID}', 'admin'),
      ('${SPACE_A_MEMBER_ID}', '${SPACE_A_ID}', 'member'),
      ('${SPACE_B_ADMIN_ID}', '${SPACE_B_ID}', 'admin'),
      ('${SPACE_B_MEMBER_ID}', '${SPACE_B_ID}', 'member')
    ON CONFLICT (user_id, space_id) DO NOTHING;

    -- =====================================================================
    -- Resource types
    -- =====================================================================
    INSERT INTO resource_types (id, space_id, slug, name)
    VALUES
      ('a0000001-0000-0000-0000-000000000001', '${SPACE_A_ID}', 'desk', 'Desk'),
      ('a0000001-0000-0000-0000-000000000002', '${SPACE_A_ID}', 'meeting-room', 'Meeting Room'),
      ('b0000001-0000-0000-0000-000000000001', '${SPACE_B_ID}', 'desk', 'Desk'),
      ('b0000001-0000-0000-0000-000000000002', '${SPACE_B_ID}', 'meeting-room', 'Meeting Room')
    ON CONFLICT (space_id, slug) DO NOTHING;

    -- =====================================================================
    -- Rate config
    -- =====================================================================
    INSERT INTO rate_config (id, space_id, resource_type_id, rate_cents)
    VALUES
      ('a0000002-0000-0000-0000-000000000001', '${SPACE_A_ID}', 'a0000001-0000-0000-0000-000000000001', 1500),
      ('a0000002-0000-0000-0000-000000000002', '${SPACE_A_ID}', 'a0000001-0000-0000-0000-000000000002', 2500),
      ('b0000002-0000-0000-0000-000000000001', '${SPACE_B_ID}', 'b0000001-0000-0000-0000-000000000001', 1500),
      ('b0000002-0000-0000-0000-000000000002', '${SPACE_B_ID}', 'b0000001-0000-0000-0000-000000000002', 2500)
    ON CONFLICT (space_id, resource_type_id) DO NOTHING;

    -- =====================================================================
    -- Plans
    -- =====================================================================
    INSERT INTO plans (id, space_id, name, slug, price_cents)
    VALUES
      ('a0000003-0000-0000-0000-000000000001', '${SPACE_A_ID}', 'Basic A', 'basic', 15000),
      ('a0000003-0000-0000-0000-000000000002', '${SPACE_A_ID}', 'Pro A', 'pro', 30000),
      ('b0000003-0000-0000-0000-000000000001', '${SPACE_B_ID}', 'Basic B', 'basic', 15000)
    ON CONFLICT (space_id, slug) DO NOTHING;

    -- =====================================================================
    -- Plan credit config
    -- =====================================================================
    INSERT INTO plan_credit_config (id, space_id, plan_id, resource_type_id, monthly_minutes)
    VALUES
      ('a0000004-0000-0000-0000-000000000001', '${SPACE_A_ID}', 'a0000003-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000002', 600),
      ('b0000004-0000-0000-0000-000000000001', '${SPACE_B_ID}', 'b0000003-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000002', 600)
    ON CONFLICT (plan_id, resource_type_id) DO NOTHING;

    -- =====================================================================
    -- Resources
    -- =====================================================================
    INSERT INTO resources (id, space_id, resource_type_id, name)
    VALUES
      ('a0000005-0000-0000-0000-000000000001', '${SPACE_A_ID}', 'a0000001-0000-0000-0000-000000000001', 'Desk A1'),
      ('a0000005-0000-0000-0000-000000000002', '${SPACE_A_ID}', 'a0000001-0000-0000-0000-000000000002', 'Room A1'),
      ('b0000005-0000-0000-0000-000000000001', '${SPACE_B_ID}', 'b0000001-0000-0000-0000-000000000001', 'Desk B1'),
      ('b0000005-0000-0000-0000-000000000002', '${SPACE_B_ID}', 'b0000001-0000-0000-0000-000000000002', 'Room B1')
    ON CONFLICT DO NOTHING;

    -- =====================================================================
    -- Members
    -- =====================================================================
    INSERT INTO members (id, space_id, user_id, plan_id)
    VALUES
      ('a0000006-0000-0000-0000-000000000001', '${SPACE_A_ID}', '${SPACE_A_MEMBER_ID}', 'a0000003-0000-0000-0000-000000000001'),
      ('b0000006-0000-0000-0000-000000000001', '${SPACE_B_ID}', '${SPACE_B_MEMBER_ID}', 'b0000003-0000-0000-0000-000000000001')
    ON CONFLICT (space_id, user_id) DO NOTHING;

    -- =====================================================================
    -- Products
    -- =====================================================================
    INSERT INTO products (id, space_id, name, slug, category, price_cents, purchase_flow)
    VALUES
      ('a0000007-0000-0000-0000-000000000001', '${SPACE_A_ID}', 'Day Pass A', 'day-pass', 'pass', 2500, 'date_picker'),
      ('b0000007-0000-0000-0000-000000000001', '${SPACE_B_ID}', 'Day Pass B', 'day-pass', 'pass', 2000, 'date_picker')
    ON CONFLICT (space_id, slug) DO NOTHING;

    -- =====================================================================
    -- Bookings
    -- =====================================================================
    INSERT INTO bookings (id, space_id, user_id, resource_id, start_time, end_time, status)
    VALUES
      ('a0000008-0000-0000-0000-000000000001', '${SPACE_A_ID}', '${SPACE_A_MEMBER_ID}',
       'a0000005-0000-0000-0000-000000000001',
       now() + interval '1 day', now() + interval '1 day 8 hours', 'confirmed'),
      ('b0000008-0000-0000-0000-000000000001', '${SPACE_B_ID}', '${SPACE_B_MEMBER_ID}',
       'b0000005-0000-0000-0000-000000000001',
       now() + interval '2 days', now() + interval '2 days 8 hours', 'confirmed')
    ON CONFLICT DO NOTHING;

    -- =====================================================================
    -- Recurring rules
    -- =====================================================================
    INSERT INTO recurring_rules (id, space_id, user_id, resource_id, pattern, start_time, end_time, day_of_week)
    VALUES
      ('a0000009-0000-0000-0000-000000000001', '${SPACE_A_ID}', '${SPACE_A_MEMBER_ID}',
       'a0000005-0000-0000-0000-000000000001', 'weekly', '09:00', '17:00', 1),
      ('b0000009-0000-0000-0000-000000000001', '${SPACE_B_ID}', '${SPACE_B_MEMBER_ID}',
       'b0000005-0000-0000-0000-000000000001', 'weekly', '09:00', '17:00', 2)
    ON CONFLICT DO NOTHING;

    -- =====================================================================
    -- Passes
    -- =====================================================================
    INSERT INTO passes (id, space_id, user_id, pass_type, status, start_date, end_date, amount_cents)
    VALUES
      ('a000000a-0000-0000-0000-000000000001', '${SPACE_A_ID}', '${SPACE_A_MEMBER_ID}',
       'day', 'active', CURRENT_DATE + 1, CURRENT_DATE + 1, 2500),
      ('b000000a-0000-0000-0000-000000000001', '${SPACE_B_ID}', '${SPACE_B_MEMBER_ID}',
       'day', 'active', CURRENT_DATE + 2, CURRENT_DATE + 2, 2000)
    ON CONFLICT DO NOTHING;

    -- =====================================================================
    -- Credit grants
    -- =====================================================================
    INSERT INTO credit_grants (id, space_id, user_id, resource_type_id, source, amount_minutes, valid_from)
    VALUES
      ('a000000b-0000-0000-0000-000000000001', '${SPACE_A_ID}', '${SPACE_A_MEMBER_ID}',
       'a0000001-0000-0000-0000-000000000002', 'subscription', 600, now()),
      ('b000000b-0000-0000-0000-000000000001', '${SPACE_B_ID}', '${SPACE_B_MEMBER_ID}',
       'b0000001-0000-0000-0000-000000000002', 'subscription', 600, now())
    ON CONFLICT DO NOTHING;

    -- =====================================================================
    -- Booking credit deductions
    -- =====================================================================
    INSERT INTO booking_credit_deductions (id, booking_id, grant_id, minutes)
    VALUES
      ('a000000c-0000-0000-0000-000000000001', 'a0000008-0000-0000-0000-000000000001',
       'a000000b-0000-0000-0000-000000000001', 60)
    ON CONFLICT DO NOTHING;

    -- =====================================================================
    -- Leads
    -- =====================================================================
    INSERT INTO leads (id, space_id, email, full_name, status)
    VALUES
      ('a000000d-0000-0000-0000-000000000001', '${SPACE_A_ID}', 'lead-a@example.com', 'Lead A', 'new'),
      ('b000000d-0000-0000-0000-000000000001', '${SPACE_B_ID}', 'lead-b@example.com', 'Lead B', 'new')
    ON CONFLICT DO NOTHING;

    -- =====================================================================
    -- Member notes
    -- =====================================================================
    INSERT INTO member_notes (id, space_id, member_id, author_id, content)
    VALUES
      ('a000000e-0000-0000-0000-000000000001', '${SPACE_A_ID}', 'a0000006-0000-0000-0000-000000000001',
       '${SPACE_A_ADMIN_ID}', 'Test note for member A'),
      ('b000000e-0000-0000-0000-000000000001', '${SPACE_B_ID}', 'b0000006-0000-0000-0000-000000000001',
       '${SPACE_B_ADMIN_ID}', 'Test note for member B')
    ON CONFLICT DO NOTHING;

    -- =====================================================================
    -- Monthly stats
    -- =====================================================================
    INSERT INTO monthly_stats (id, space_id, month, total_members, mrr_cents)
    VALUES
      ('a000000f-0000-0000-0000-000000000001', '${SPACE_A_ID}', '2026-01-01', 10, 150000),
      ('b000000f-0000-0000-0000-000000000001', '${SPACE_B_ID}', '2026-01-01', 5, 75000)
    ON CONFLICT (space_id, month) DO NOTHING;

    -- =====================================================================
    -- Daily stats
    -- =====================================================================
    INSERT INTO daily_stats (id, space_id, date, desk_occupancy, room_bookings)
    VALUES
      ('a0000010-0000-0000-0000-000000000001', '${SPACE_A_ID}', '2026-01-15', 0.75, 12),
      ('b0000010-0000-0000-0000-000000000001', '${SPACE_B_ID}', '2026-01-15', 0.60, 8)
    ON CONFLICT (space_id, date) DO NOTHING;

    -- =====================================================================
    -- Payment events
    -- =====================================================================
    INSERT INTO payment_events (id, space_id, stripe_event_id, event_type, payload)
    VALUES
      ('a0000011-0000-0000-0000-000000000001', '${SPACE_A_ID}', 'evt_test_a_001', 'checkout.session.completed', '{"test": true}'),
      ('b0000011-0000-0000-0000-000000000001', '${SPACE_B_ID}', 'evt_test_b_001', 'checkout.session.completed', '{"test": true}')
    ON CONFLICT (stripe_event_id) DO NOTHING;

    -- =====================================================================
    -- Space closures
    -- =====================================================================
    INSERT INTO space_closures (id, space_id, date, reason, all_day)
    VALUES
      ('a0000012-0000-0000-0000-000000000001', '${SPACE_A_ID}', '2026-12-25', 'Christmas', true),
      ('b0000012-0000-0000-0000-000000000001', '${SPACE_B_ID}', '2026-12-25', 'Christmas', true)
    ON CONFLICT (space_id, date) DO NOTHING;

    -- =====================================================================
    -- Notifications log
    -- =====================================================================
    INSERT INTO notifications_log (id, space_id, user_id, channel, template, recipient)
    VALUES
      ('a0000013-0000-0000-0000-000000000001', '${SPACE_A_ID}', '${SPACE_A_MEMBER_ID}', 'email', 'booking_reminder', 'space-a-member@test.com'),
      ('b0000013-0000-0000-0000-000000000001', '${SPACE_B_ID}', '${SPACE_B_MEMBER_ID}', 'email', 'booking_reminder', 'space-b-member@test.com')
    ON CONFLICT DO NOTHING;

    -- =====================================================================
    -- Waitlist
    -- =====================================================================
    INSERT INTO waitlist (id, space_id, user_id, resource_id, desired_date)
    VALUES
      ('a0000014-0000-0000-0000-000000000001', '${SPACE_A_ID}', '${SPACE_A_MEMBER_ID}',
       'a0000005-0000-0000-0000-000000000002', '2026-03-20'),
      ('b0000014-0000-0000-0000-000000000001', '${SPACE_B_ID}', '${SPACE_B_MEMBER_ID}',
       'b0000005-0000-0000-0000-000000000002', '2026-03-20')
    ON CONFLICT DO NOTHING;

    -- =====================================================================
    -- Notification preferences
    -- =====================================================================
    INSERT INTO notification_preferences (id, space_id, user_id)
    VALUES
      ('a0000015-0000-0000-0000-000000000001', '${SPACE_A_ID}', '${SPACE_A_MEMBER_ID}'),
      ('b0000015-0000-0000-0000-000000000001', '${SPACE_B_ID}', '${SPACE_B_MEMBER_ID}')
    ON CONFLICT (space_id, user_id) DO NOTHING;

    -- =====================================================================
    -- Import jobs
    -- =====================================================================
    INSERT INTO import_jobs (id, space_id, admin_id, source, status, summary)
    VALUES
      ('a0000016-0000-0000-0000-000000000001', '${SPACE_A_ID}', '${SPACE_A_ADMIN_ID}',
       'officernd', 'completed', '{"members": 10, "bookings": 25}'),
      ('b0000016-0000-0000-0000-000000000001', '${SPACE_B_ID}', '${SPACE_B_ADMIN_ID}',
       'officernd', 'completed', '{"members": 5, "bookings": 12}')
    ON CONFLICT DO NOTHING;
  `;
  psqlMulti(sql);
}

/**
 * Clean up all test data (reverse order of seeding).
 */
export function cleanupTestData(): void {
  const sql = `
    DELETE FROM import_jobs WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM notification_preferences WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM waitlist WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM notifications_log WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM space_closures WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM payment_events WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM daily_stats WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM monthly_stats WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM member_notes WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM booking_credit_deductions WHERE booking_id IN (
      SELECT id FROM bookings WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}')
    );
    DELETE FROM credit_grants WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM passes WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM bookings WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM recurring_rules WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM members WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM products WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM plan_credit_config WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM plans WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM resources WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM rate_config WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM resource_types WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM space_users WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM platform_admins WHERE user_id = '${PLATFORM_ADMIN_ID}';
    DELETE FROM leads WHERE space_id IN ('${SPACE_A_ID}', '${SPACE_B_ID}');
    DELETE FROM spaces WHERE id = '${SPACE_B_ID}';
    DELETE FROM tenants WHERE id = '${TENANT_B_ID}';
    DELETE FROM shared_profiles WHERE id IN (
      '${PLATFORM_ADMIN_ID}', '${SPACE_A_ADMIN_ID}', '${SPACE_A_MEMBER_ID}',
      '${SPACE_B_ADMIN_ID}', '${SPACE_B_MEMBER_ID}', '${UNRELATED_USER_ID}'
    );
    DELETE FROM auth.users WHERE id IN (
      '${PLATFORM_ADMIN_ID}', '${SPACE_A_ADMIN_ID}', '${SPACE_A_MEMBER_ID}',
      '${SPACE_B_ADMIN_ID}', '${SPACE_B_MEMBER_ID}', '${UNRELATED_USER_ID}'
    );
  `;
  psqlMulti(sql);
}
