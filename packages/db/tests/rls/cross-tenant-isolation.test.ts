/**
 * RLS Tests: Cross-Tenant / Cross-Space Isolation
 *
 * Comprehensive tests ensuring that users in one tenant/space cannot
 * access data in another tenant/space, covering ALL 26 tables.
 */

import { describe, it, expect } from 'vitest';
import {
  userClient,
  TENANT_ID,
  TENANT_B_ID,
  SPACE_A_ID,
  SPACE_B_ID,
  PLATFORM_ADMIN_ID,
  SPACE_A_ADMIN_ID,
  SPACE_A_MEMBER_ID,
  SPACE_B_ADMIN_ID,
  SPACE_B_MEMBER_ID,
} from './helpers';

// =========================================================================
// All tables that contain space_id column (except tenants which uses tenant_id)
// =========================================================================

const SPACE_SCOPED_TABLES = [
  'resource_types',
  'rate_config',
  'plans',
  'plan_credit_config',
  'resources',
  'products',
  'members',
  'member_notes',
  'bookings',
  'recurring_rules',
  'passes',
  'credit_grants',
  'leads',
  'monthly_stats',
  'daily_stats',
  'payment_events',
  'space_closures',
  'notifications_log',
  'waitlist',
  'notification_preferences',
  'import_jobs',
] as const;

describe('cross-space read isolation for space admin', () => {
  it.each(SPACE_SCOPED_TABLES)(
    'Space A admin cannot read %s from Space B',
    async (table) => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data } = await client
        .from(table)
        .select('id, space_id' as 'id')
        .eq('space_id', SPACE_B_ID);
      expect(data).toEqual([]);
    }
  );

  it.each(SPACE_SCOPED_TABLES)(
    'Space B admin cannot read %s from Space A',
    async (table) => {
      const client = userClient(SPACE_B_ADMIN_ID, SPACE_B_ID);
      const { data } = await client
        .from(table)
        .select('id, space_id' as 'id')
        .eq('space_id', SPACE_A_ID);
      expect(data).toEqual([]);
    }
  );
});

describe('cross-space read isolation for regular members', () => {
  it.each(SPACE_SCOPED_TABLES)(
    'Space A member cannot read %s from Space B',
    async (table) => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client
        .from(table)
        .select('id, space_id' as 'id')
        .eq('space_id', SPACE_B_ID);
      expect(data).toEqual([]);
    }
  );
});

describe('JWT space_id mismatch prevents access', () => {
  it.each(SPACE_SCOPED_TABLES)(
    'Space A admin with Space B JWT cannot read own %s',
    async (table) => {
      // Space A admin holds Space B in JWT -- should NOT see Space A data
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_B_ID);
      const { data } = await client
        .from(table)
        .select('id, space_id' as 'id')
        .eq('space_id', SPACE_A_ID);
      expect(data).toEqual([]);
    }
  );
});

describe('cross-tenant write isolation', () => {
  it('Space A admin cannot insert resource in Space B', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { error } = await client.from('resources').insert({
      space_id: SPACE_B_ID,
      resource_type_id: 'b0000001-0000-0000-0000-000000000001',
      name: 'Hacked Resource',
    });
    expect(error).not.toBeNull();
  });

  it('Space A admin cannot insert booking in Space B', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { error } = await client.from('bookings').insert({
      space_id: SPACE_B_ID,
      user_id: SPACE_B_MEMBER_ID,
      resource_id: 'b0000005-0000-0000-0000-000000000001',
      start_time: new Date(Date.now() + 86400000 * 3).toISOString(),
      end_time: new Date(Date.now() + 86400000 * 3 + 28800000).toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it('Space A admin cannot update leads in Space B', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { data } = await client
      .from('leads')
      .update({ admin_notes: 'Hacked' })
      .eq('id', 'b000000d-0000-0000-0000-000000000001')
      .select();
    expect(data).toEqual([]);
  });

  it('Space A admin cannot delete members in Space B', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { data } = await client
      .from('members')
      .delete()
      .eq('id', 'b0000006-0000-0000-0000-000000000001')
      .select();
    expect(data).toEqual([]);
  });

  it('Space A admin cannot insert plans in Space B', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { error } = await client.from('plans').insert({
      space_id: SPACE_B_ID,
      name: 'Hacked Plan',
      slug: 'hacked-plan',
      price_cents: 9900,
    });
    expect(error).not.toBeNull();
  });

  it('Space A admin cannot insert products in Space B', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { error } = await client.from('products').insert({
      space_id: SPACE_B_ID,
      name: 'Hacked Product',
      slug: 'hacked-product',
      category: 'pass',
      price_cents: 5000,
      purchase_flow: 'checkout',
    });
    expect(error).not.toBeNull();
  });

  it('Space A admin cannot insert import_jobs in Space B', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { error } = await client.from('import_jobs').insert({
      space_id: SPACE_B_ID,
      admin_id: SPACE_A_ADMIN_ID,
      source: 'officernd',
    });
    expect(error).not.toBeNull();
  });

  it('Space A admin cannot update import_jobs in Space B', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { data } = await client
      .from('import_jobs')
      .update({ status: 'failed' })
      .eq('id', 'b0000016-0000-0000-0000-000000000001')
      .select();
    expect(data).toEqual([]);
  });

  it('Space A admin cannot insert member_notes in Space B', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { error } = await client.from('member_notes').insert({
      space_id: SPACE_B_ID,
      member_id: 'b0000006-0000-0000-0000-000000000001',
      author_id: SPACE_A_ADMIN_ID,
      content: 'Hacked note from Space A admin',
    });
    expect(error).not.toBeNull();
  });

  it('Space A admin cannot update monthly_stats in Space B', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { data } = await client
      .from('monthly_stats')
      .update({ total_members: 999 })
      .eq('id', 'b000000f-0000-0000-0000-000000000001')
      .select();
    expect(data).toEqual([]);
  });

  it('Space A admin cannot delete payment_events in Space B', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { data } = await client
      .from('payment_events')
      .delete()
      .eq('id', 'b0000011-0000-0000-0000-000000000001')
      .select();
    expect(data).toEqual([]);
  });

  it('Space A admin cannot delete space_closures in Space B', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { data } = await client
      .from('space_closures')
      .delete()
      .eq('id', 'b0000012-0000-0000-0000-000000000001')
      .select();
    expect(data).toEqual([]);
  });
});

describe('tenant-level isolation', () => {
  it('Space A admin cannot read Tenant B', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { data } = await client
      .from('tenants')
      .select('id')
      .eq('id', TENANT_B_ID);
    expect(data).toEqual([]);
  });

  it('Space B admin cannot read Tenant A', async () => {
    const client = userClient(SPACE_B_ADMIN_ID, SPACE_B_ID);
    const { data } = await client
      .from('tenants')
      .select('id')
      .eq('id', TENANT_ID);
    expect(data).toEqual([]);
  });
});

describe('platform admin can access all spaces', () => {
  it.each(SPACE_SCOPED_TABLES)(
    'platform admin can read %s from both spaces',
    async (table) => {
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client.from(table).select('id');
      expect(error).toBeNull();
      // Should have data from both Space A and Space B
      expect(data!.length).toBeGreaterThanOrEqual(2);
    }
  );
});

describe('space_users cross-space isolation', () => {
  it('Space A admin can see Space A users but not Space B users', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { data } = await client
      .from('space_users')
      .select('id, space_id');

    const spaceIds = data!.map(
      (row: { id: string; space_id: string }) => row.space_id
    );
    expect(spaceIds).toContain(SPACE_A_ID);
    expect(spaceIds).not.toContain(SPACE_B_ID);
  });
});

describe('shared_profiles cross-space isolation', () => {
  it('Space A admin can only see profiles of Space A users (plus own)', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { data } = await client
      .from('shared_profiles')
      .select('id');

    const ids = data!.map((row: { id: string }) => row.id);
    // Should see own profile + Space A member
    expect(ids).toContain(SPACE_A_ADMIN_ID);
    expect(ids).toContain(SPACE_A_MEMBER_ID);
    // Should NOT see Space B member
    expect(ids).not.toContain(SPACE_B_MEMBER_ID);
  });
});
