/**
 * RLS Tests: Admin-Only Tables
 *
 * Tests for tables that have NO public_read and NO users_read_own policies.
 * Only space_admins_manage + platform_admins_full.
 *
 * Tables: leads, member_notes, monthly_stats, daily_stats,
 *         payment_events, notifications_log
 */

import { describe, it, expect } from 'vitest';
import {
  anonClient,
  userClient,
  serviceClient,
  SPACE_A_ID,
  SPACE_B_ID,
  PLATFORM_ADMIN_ID,
  SPACE_A_ADMIN_ID,
  SPACE_A_MEMBER_ID,
  SPACE_B_ADMIN_ID,
  SPACE_B_MEMBER_ID,
  UNRELATED_USER_ID,
} from './helpers';

const ADMIN_ONLY_TABLES = [
  'leads',
  'member_notes',
  'monthly_stats',
  'daily_stats',
  'payment_events',
  'notifications_log',
] as const;

type AdminOnlyTable = (typeof ADMIN_ONLY_TABLES)[number];

describe.each(ADMIN_ONLY_TABLES)('%s', (table: AdminOnlyTable) => {
  describe('anon', () => {
    it('cannot read any rows', async () => {
      const client = anonClient();
      const { data } = await client.from(table).select('id');
      expect(data).toEqual([]);
    });

    it('cannot insert rows', async () => {
      const client = anonClient();
      const { error } = await client.from(table).insert({
        space_id: SPACE_A_ID,
      });
      expect(error).not.toBeNull();
    });
  });

  describe('regular member', () => {
    it('cannot read any rows', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client.from(table).select('id');
      expect(data).toEqual([]);
    });

    it('cannot insert rows', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { error } = await client
        .from(table)
        .insert({ space_id: SPACE_A_ID } as Record<string, unknown>);
      expect(error).not.toBeNull();
    });

    it('cannot update rows', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client
        .from(table)
        .update({ space_id: SPACE_A_ID } as Record<string, unknown>)
        .eq('space_id', SPACE_A_ID)
        .select();
      expect(data).toEqual([]);
    });

    it('cannot delete rows', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client
        .from(table)
        .delete()
        .eq('space_id', SPACE_A_ID)
        .select();
      expect(data).toEqual([]);
    });
  });

  describe('space admin', () => {
    it('can read rows in own space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client.from(table).select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('cannot read rows in another space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data } = await client
        .from(table)
        .select('id, space_id' as 'id')
        .eq('space_id', SPACE_B_ID);
      expect(data).toEqual([]);
    });
  });

  describe('cross-space admin isolation', () => {
    it('Space B admin cannot read Space A data', async () => {
      const client = userClient(SPACE_B_ADMIN_ID, SPACE_B_ID);
      const { data } = await client
        .from(table)
        .select('id, space_id' as 'id')
        .eq('space_id', SPACE_A_ID);
      expect(data).toEqual([]);
    });
  });

  describe('platform admin', () => {
    it('can read all rows across spaces', async () => {
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client.from(table).select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// =========================================================================
// Space admin write tests (table-specific)
// =========================================================================

describe('space admin write operations', () => {
  describe('leads', () => {
    it('can insert leads in own space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client.from('leads').insert({
        space_id: SPACE_A_ID,
        email: 'new-lead@test.com',
        full_name: 'New Lead',
      });
      expect(error).toBeNull();

      // Cleanup
      const svc = serviceClient();
      await svc.from('leads').delete().eq('email', 'new-lead@test.com');
    });

    it('cannot insert leads in another space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client.from('leads').insert({
        space_id: SPACE_B_ID,
        email: 'hacked-lead@test.com',
        full_name: 'Hacked Lead',
      });
      expect(error).not.toBeNull();
    });

    it('can update leads in own space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client
        .from('leads')
        .update({ admin_notes: 'Updated' })
        .eq('id', 'a000000d-0000-0000-0000-000000000001');
      expect(error).toBeNull();
    });

    it('can delete leads in own space', async () => {
      const svc = serviceClient();
      await svc.from('leads').insert({
        id: 'a000000d-0000-0000-0000-000000000099',
        space_id: SPACE_A_ID,
        email: 'delete-lead@test.com',
      });

      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client
        .from('leads')
        .delete()
        .eq('id', 'a000000d-0000-0000-0000-000000000099');
      expect(error).toBeNull();
    });
  });

  describe('member_notes', () => {
    it('can insert member_notes in own space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client.from('member_notes').insert({
        space_id: SPACE_A_ID,
        member_id: 'a0000006-0000-0000-0000-000000000001',
        author_id: SPACE_A_ADMIN_ID,
        content: 'Admin test note',
      });
      expect(error).toBeNull();
    });

    it('cannot insert member_notes in another space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client.from('member_notes').insert({
        space_id: SPACE_B_ID,
        member_id: 'b0000006-0000-0000-0000-000000000001',
        author_id: SPACE_A_ADMIN_ID,
        content: 'Hacked note',
      });
      expect(error).not.toBeNull();
    });
  });

  describe('monthly_stats', () => {
    it('can insert stats in own space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client.from('monthly_stats').insert({
        space_id: SPACE_A_ID,
        month: '2026-02-01',
        total_members: 15,
      });
      expect(error).toBeNull();

      const svc = serviceClient();
      await svc
        .from('monthly_stats')
        .delete()
        .eq('month', '2026-02-01')
        .eq('space_id', SPACE_A_ID);
    });
  });

  describe('daily_stats', () => {
    it('can insert stats in own space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client.from('daily_stats').insert({
        space_id: SPACE_A_ID,
        date: '2026-01-16',
        desk_occupancy: 0.8,
      });
      expect(error).toBeNull();

      const svc = serviceClient();
      await svc
        .from('daily_stats')
        .delete()
        .eq('date', '2026-01-16')
        .eq('space_id', SPACE_A_ID);
    });
  });

  describe('payment_events', () => {
    it('can insert payment_events in own space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client.from('payment_events').insert({
        space_id: SPACE_A_ID,
        stripe_event_id: 'evt_admin_test_001',
        event_type: 'test.event',
        payload: { test: true },
      });
      expect(error).toBeNull();

      const svc = serviceClient();
      await svc
        .from('payment_events')
        .delete()
        .eq('stripe_event_id', 'evt_admin_test_001');
    });
  });
});

// =========================================================================
// Unrelated user
// =========================================================================
describe('unrelated user (no space membership)', () => {
  it.each(ADMIN_ONLY_TABLES)(
    '%s: cannot read any data even with space_id in JWT',
    async (table) => {
      const client = userClient(UNRELATED_USER_ID, SPACE_A_ID);
      const { data } = await client.from(table).select('id');
      expect(data).toEqual([]);
    }
  );
});
