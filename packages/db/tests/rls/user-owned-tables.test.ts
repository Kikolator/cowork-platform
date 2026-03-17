/**
 * RLS Tests: User-Owned Data Tables
 *
 * Tests for tables with the pattern:
 *   users_read_own: FOR SELECT USING (user_id = auth.uid() AND space_id = current_space_id())
 *   space_admins_manage: FOR ALL
 *   platform_admins_full: FOR ALL
 *
 * Tables: bookings, members, passes, credit_grants, recurring_rules,
 *         waitlist, notification_preferences, booking_credit_deductions
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

// =========================================================================
// Tables with standard users_read_own pattern (user_id + space_id)
// =========================================================================
const USER_OWNED_TABLES = [
  'bookings',
  'members',
  'passes',
  'credit_grants',
  'recurring_rules',
  'waitlist',
  'notification_preferences',
] as const;

type UserOwnedTable = (typeof USER_OWNED_TABLES)[number];

describe.each(USER_OWNED_TABLES)('%s', (table: UserOwnedTable) => {
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
        user_id: SPACE_A_MEMBER_ID,
      });
      expect(error).not.toBeNull();
    });
  });

  describe('own data access', () => {
    it('member can read own rows with correct space_id in JWT', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data, error } = await client.from(table).select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('member cannot read own rows with wrong space_id in JWT', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_B_ID);
      const { data } = await client.from(table).select('id');
      expect(data).toEqual([]);
    });
  });

  describe('cross-user isolation', () => {
    it('member A cannot read member B data', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client
        .from(table)
        .select('id')
        .eq('user_id', SPACE_B_MEMBER_ID);
      expect(data).toEqual([]);
    });

    it('member of Space B cannot read Space A data', async () => {
      const client = userClient(SPACE_B_MEMBER_ID, SPACE_B_ID);
      const { data } = await client
        .from(table)
        .select('id')
        .eq('space_id', SPACE_A_ID);
      expect(data).toEqual([]);
    });
  });

  describe('write protection', () => {
    it('member cannot insert rows', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { error } = await client
        .from(table)
        .insert({ space_id: SPACE_A_ID } as Record<string, unknown>);
      expect(error).not.toBeNull();
    });

    it('member cannot delete rows', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client
        .from(table)
        .delete()
        .eq('user_id', SPACE_A_MEMBER_ID)
        .select();
      expect(data).toEqual([]);
    });
  });

  describe('space admin access', () => {
    it('can read all rows in own space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client.from(table).select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('cannot access data in another space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data } = await client
        .from(table)
        .select('id')
        .eq('space_id', SPACE_B_ID);
      expect(data).toEqual([]);
    });
  });

  describe('platform admin access', () => {
    it('can read all rows across all spaces', async () => {
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client.from(table).select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// =========================================================================
// notification_preferences: extra users_update_own policy
// =========================================================================
describe('notification_preferences: users_update_own', () => {
  it('member can update own notification preferences', async () => {
    const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
    const { error } = await client
      .from('notification_preferences')
      .update({ marketing: true })
      .eq('user_id', SPACE_A_MEMBER_ID)
      .eq('space_id', SPACE_A_ID);
    expect(error).toBeNull();
  });

  it('member cannot update other user notification preferences', async () => {
    const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
    const { data } = await client
      .from('notification_preferences')
      .update({ marketing: true })
      .eq('user_id', SPACE_B_MEMBER_ID)
      .select();
    expect(data).toEqual([]);
  });

  it('member cannot update own prefs with wrong space_id', async () => {
    const client = userClient(SPACE_A_MEMBER_ID, SPACE_B_ID);
    const { data } = await client
      .from('notification_preferences')
      .update({ marketing: false })
      .eq('user_id', SPACE_A_MEMBER_ID)
      .eq('space_id', SPACE_A_ID)
      .select();
    expect(data).toEqual([]);
  });
});

// =========================================================================
// booking_credit_deductions: special join-based policy
// =========================================================================
describe('booking_credit_deductions', () => {
  describe('anon', () => {
    it('cannot read any rows', async () => {
      const client = anonClient();
      const { data } = await client
        .from('booking_credit_deductions')
        .select('id');
      expect(data).toEqual([]);
    });
  });

  describe('own data access (via booking join)', () => {
    it('member can read deductions for own bookings', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data, error } = await client
        .from('booking_credit_deductions')
        .select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('member cannot read deductions for other bookings', async () => {
      const client = userClient(SPACE_B_MEMBER_ID, SPACE_B_ID);
      const { data } = await client
        .from('booking_credit_deductions')
        .select('id')
        .eq('id', 'a000000c-0000-0000-0000-000000000001');
      expect(data).toEqual([]);
    });
  });

  describe('cross-user isolation', () => {
    it('member A cannot read deductions for member B bookings', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      // Space A member with Space A JWT should not see Space B deductions
      // (the bookings are in different spaces)
      const { data } = await client
        .from('booking_credit_deductions')
        .select('id')
        .eq('booking_id', 'b0000008-0000-0000-0000-000000000001');
      expect(data).toEqual([]);
    });
  });

  describe('space admin', () => {
    it('can read deductions for bookings in own space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client
        .from('booking_credit_deductions')
        .select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('cannot read deductions for bookings in another space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data } = await client
        .from('booking_credit_deductions')
        .select('id')
        .eq('booking_id', 'b0000008-0000-0000-0000-000000000001');
      expect(data).toEqual([]);
    });
  });

  describe('platform admin', () => {
    it('can read all deductions', async () => {
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client
        .from('booking_credit_deductions')
        .select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// =========================================================================
// Unrelated user tests
// =========================================================================
describe('unrelated user (no space membership)', () => {
  it.each(USER_OWNED_TABLES)(
    '%s: cannot read any data even with space_id in JWT',
    async (table) => {
      const client = userClient(UNRELATED_USER_ID, SPACE_A_ID);
      const { data } = await client.from(table).select('id');
      // users_read_own requires user_id = auth.uid(), so unrelated user sees nothing
      expect(data).toEqual([]);
    }
  );
});
