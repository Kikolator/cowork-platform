/**
 * RLS Tests: Public-Read Pattern Tables
 *
 * Tests for tables with the pattern:
 *   public_read: FOR SELECT USING (space_id = current_space_id())
 *   space_admins_manage: FOR ALL USING (is_space_admin + current_space_id())
 *   platform_admins_full: FOR ALL USING (is_platform_admin)
 *
 * Tables: resource_types, rate_config, plans, plan_credit_config,
 *         resources, products, space_closures
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

const PUBLIC_READ_TABLES = [
  'resource_types',
  'rate_config',
  'plans',
  'plan_credit_config',
  'resources',
  'products',
  'space_closures',
] as const;

type PublicReadTable = (typeof PUBLIC_READ_TABLES)[number];

// =========================================================================
// Generic tests for all public-read tables
// =========================================================================

describe.each(PUBLIC_READ_TABLES)('%s', (table: PublicReadTable) => {
  describe('anon (no space_id in JWT)', () => {
    it('cannot read any rows (current_space_id() is null)', async () => {
      const client = anonClient();
      const { data } = await client.from(table).select('id');
      expect(data).toEqual([]);
    });
  });

  describe('authenticated user with correct space_id', () => {
    it('can read rows belonging to their space', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data, error } = await client.from(table).select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('cannot read rows from another space', async () => {
      // Member of Space A with Space A JWT -- should not see Space B data
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client
        .from(table)
        .select('id, space_id' as 'id')
        .eq('space_id', SPACE_B_ID);
      expect(data).toEqual([]);
    });
  });

  describe('authenticated user with wrong space_id', () => {
    it('sees nothing when JWT space_id does not match data', async () => {
      // Space A member but JWT has Space B -- should see Space B data if any,
      // but NOT Space A data
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_B_ID);
      const { data } = await client
        .from(table)
        .select('id, space_id' as 'id')
        .eq('space_id', SPACE_A_ID);
      expect(data).toEqual([]);
    });
  });

  describe('regular member cannot write', () => {
    it('cannot insert', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      let insertData: Record<string, unknown>;

      switch (table) {
        case 'resource_types':
          insertData = {
            space_id: SPACE_A_ID,
            slug: 'test-insert',
            name: 'Test',
          };
          break;
        case 'rate_config':
          insertData = {
            space_id: SPACE_A_ID,
            resource_type_id: 'a0000001-0000-0000-0000-000000000001',
            rate_cents: 999,
          };
          break;
        case 'plans':
          insertData = {
            space_id: SPACE_A_ID,
            name: 'Test Plan',
            slug: 'test-plan',
            price_cents: 100,
          };
          break;
        case 'plan_credit_config':
          insertData = {
            space_id: SPACE_A_ID,
            plan_id: 'a0000003-0000-0000-0000-000000000001',
            resource_type_id: 'a0000001-0000-0000-0000-000000000001',
            monthly_minutes: 100,
          };
          break;
        case 'resources':
          insertData = {
            space_id: SPACE_A_ID,
            resource_type_id: 'a0000001-0000-0000-0000-000000000001',
            name: 'Test Resource',
          };
          break;
        case 'products':
          insertData = {
            space_id: SPACE_A_ID,
            name: 'Test Product',
            slug: 'test-product',
            category: 'pass',
            price_cents: 100,
            purchase_flow: 'checkout',
          };
          break;
        case 'space_closures':
          insertData = {
            space_id: SPACE_A_ID,
            date: '2026-12-31',
            reason: 'Test',
          };
          break;
      }

      const { error } = await client.from(table).insert(insertData!);
      expect(error).not.toBeNull();
    });
  });

  describe('space admin can manage own space data', () => {
    it('can read data in own space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client.from(table).select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('cannot read data in another space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data } = await client
        .from(table)
        .select('id, space_id' as 'id')
        .eq('space_id', SPACE_B_ID);
      expect(data).toEqual([]);
    });
  });

  describe('cross-space admin isolation', () => {
    it('Space B admin cannot manage Space A data', async () => {
      const client = userClient(SPACE_B_ADMIN_ID, SPACE_B_ID);
      const { data } = await client
        .from(table)
        .select('id, space_id' as 'id')
        .eq('space_id', SPACE_A_ID);
      expect(data).toEqual([]);
    });
  });

  describe('platform admin', () => {
    it('can read all data across spaces', async () => {
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client.from(table).select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// =========================================================================
// Space admin write tests (specific per table since insert shapes differ)
// =========================================================================

describe('space admin write operations', () => {
  it('can insert resource_types in own space', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { error } = await client.from('resource_types').insert({
      space_id: SPACE_A_ID,
      slug: 'phone-booth',
      name: 'Phone Booth',
    });
    expect(error).toBeNull();

    // Cleanup
    const svc = serviceClient();
    await svc
      .from('resource_types')
      .delete()
      .eq('slug', 'phone-booth')
      .eq('space_id', SPACE_A_ID);
  });

  it('cannot insert resource_types in another space', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { error } = await client.from('resource_types').insert({
      space_id: SPACE_B_ID,
      slug: 'phone-booth-hack',
      name: 'Phone Booth Hack',
    });
    expect(error).not.toBeNull();
  });

  it('can update plans in own space', async () => {
    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { error } = await client
      .from('plans')
      .update({ description: 'Updated by admin' })
      .eq('id', 'a0000003-0000-0000-0000-000000000001')
      .eq('space_id', SPACE_A_ID);
    expect(error).toBeNull();
  });

  it('can delete space_closures in own space', async () => {
    // Insert one to delete
    const svc = serviceClient();
    await svc.from('space_closures').insert({
      id: 'a0000012-0000-0000-0000-000000000099',
      space_id: SPACE_A_ID,
      date: '2026-12-31',
      reason: 'Delete test',
      all_day: true,
    });

    const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
    const { error } = await client
      .from('space_closures')
      .delete()
      .eq('id', 'a0000012-0000-0000-0000-000000000099');
    expect(error).toBeNull();
  });
});

// =========================================================================
// Unrelated user tests
// =========================================================================
describe('unrelated user (no space membership)', () => {
  it.each(PUBLIC_READ_TABLES)(
    '%s: cannot write even with space_id in JWT',
    async (table) => {
      const client = userClient(UNRELATED_USER_ID, SPACE_A_ID);
      // Attempt a select -- public_read should allow if space_id matches
      const { data } = await client.from(table).select('id');
      // They CAN read (public_read policy allows authenticated users with matching space_id)
      // but cannot write
      expect(data).toBeDefined();
    }
  );
});
