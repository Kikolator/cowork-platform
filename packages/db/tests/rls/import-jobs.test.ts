/**
 * RLS Tests: import_jobs Table
 *
 * Tests for the import_jobs table (migration 00016). Admin-only pattern:
 *   space_admins_manage: FOR ALL USING (is_space_admin + space_id match via current_space_id())
 *   platform_admins_full: FOR ALL USING (is_platform_admin)
 *
 * The original policy used a raw JWT accessor (auth.jwt() ->> 'space_id')
 * which read from the wrong JWT path. Migration fix_import_jobs_rls_jwt_path
 * corrected it to use current_space_id() like all other tables.
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
// Anon access
// =========================================================================
describe('import_jobs', () => {
  describe('anon', () => {
    it('cannot read any rows', async () => {
      const client = anonClient();
      const { data } = await client.from('import_jobs').select('id');
      expect(data).toEqual([]);
    });

    it('cannot insert rows', async () => {
      const client = anonClient();
      const { error } = await client.from('import_jobs').insert({
        space_id: SPACE_A_ID,
        admin_id: SPACE_A_ADMIN_ID,
        source: 'officernd',
      });
      expect(error).not.toBeNull();
    });
  });

  // =========================================================================
  // Regular member
  // =========================================================================
  describe('regular member', () => {
    it('cannot read any rows', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client.from('import_jobs').select('id');
      expect(data).toEqual([]);
    });

    it('cannot insert rows', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { error } = await client.from('import_jobs').insert({
        space_id: SPACE_A_ID,
        admin_id: SPACE_A_MEMBER_ID,
        source: 'officernd',
      });
      expect(error).not.toBeNull();
    });

    it('cannot update rows', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client
        .from('import_jobs')
        .update({ status: 'failed' })
        .eq('space_id', SPACE_A_ID)
        .select();
      expect(data).toEqual([]);
    });

    it('cannot delete rows', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client
        .from('import_jobs')
        .delete()
        .eq('space_id', SPACE_A_ID)
        .select();
      expect(data).toEqual([]);
    });
  });

  // =========================================================================
  // Space admin
  // =========================================================================
  describe('space admin', () => {
    it('can read rows in own space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client.from('import_jobs').select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('cannot read rows in another space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data } = await client
        .from('import_jobs')
        .select('id, space_id' as 'id')
        .eq('space_id', SPACE_B_ID);
      expect(data).toEqual([]);
    });

    it('can insert import_jobs in own space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client.from('import_jobs').insert({
        space_id: SPACE_A_ID,
        admin_id: SPACE_A_ADMIN_ID,
        source: 'csv',
        status: 'in_progress',
      });
      expect(error).toBeNull();

      // Cleanup
      const svc = serviceClient();
      await svc
        .from('import_jobs')
        .delete()
        .eq('source', 'csv')
        .eq('space_id', SPACE_A_ID);
    });

    it('cannot insert import_jobs in another space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client.from('import_jobs').insert({
        space_id: SPACE_B_ID,
        admin_id: SPACE_A_ADMIN_ID,
        source: 'officernd',
      });
      expect(error).not.toBeNull();
    });

    it('can update import_jobs in own space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client
        .from('import_jobs')
        .update({ status: 'completed' })
        .eq('id', 'a0000016-0000-0000-0000-000000000001');
      expect(error).toBeNull();
    });

    it('cannot update import_jobs in another space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data } = await client
        .from('import_jobs')
        .update({ status: 'failed' })
        .eq('id', 'b0000016-0000-0000-0000-000000000001')
        .select();
      expect(data).toEqual([]);
    });

    it('can delete import_jobs in own space', async () => {
      // Insert one to delete
      const svc = serviceClient();
      await svc.from('import_jobs').insert({
        id: 'a0000016-0000-0000-0000-000000000099',
        space_id: SPACE_A_ID,
        admin_id: SPACE_A_ADMIN_ID,
        source: 'officernd',
        status: 'failed',
      });

      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client
        .from('import_jobs')
        .delete()
        .eq('id', 'a0000016-0000-0000-0000-000000000099');
      expect(error).toBeNull();
    });

    it('cannot delete import_jobs in another space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data } = await client
        .from('import_jobs')
        .delete()
        .eq('id', 'b0000016-0000-0000-0000-000000000001')
        .select();
      expect(data).toEqual([]);
    });
  });

  // =========================================================================
  // Cross-space admin isolation
  // =========================================================================
  describe('cross-space admin isolation', () => {
    it('Space B admin cannot read Space A import_jobs', async () => {
      const client = userClient(SPACE_B_ADMIN_ID, SPACE_B_ID);
      const { data } = await client
        .from('import_jobs')
        .select('id, space_id' as 'id')
        .eq('space_id', SPACE_A_ID);
      expect(data).toEqual([]);
    });

    it('Space A admin cannot read Space B import_jobs', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data } = await client
        .from('import_jobs')
        .select('id, space_id' as 'id')
        .eq('space_id', SPACE_B_ID);
      expect(data).toEqual([]);
    });
  });

  // =========================================================================
  // Platform admin
  // =========================================================================
  describe('platform admin', () => {
    it('can read all rows across spaces', async () => {
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client.from('import_jobs').select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
    });

    it('can insert import_jobs in any space', async () => {
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { error } = await client.from('import_jobs').insert({
        space_id: SPACE_B_ID,
        admin_id: PLATFORM_ADMIN_ID,
        source: 'platform_migration',
      });
      expect(error).toBeNull();

      // Cleanup
      const svc = serviceClient();
      await svc
        .from('import_jobs')
        .delete()
        .eq('source', 'platform_migration');
    });

    it('can delete import_jobs in any space', async () => {
      const svc = serviceClient();
      await svc.from('import_jobs').insert({
        id: 'b0000016-0000-0000-0000-000000000099',
        space_id: SPACE_B_ID,
        admin_id: SPACE_B_ADMIN_ID,
        source: 'officernd',
        status: 'failed',
      });

      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { error } = await client
        .from('import_jobs')
        .delete()
        .eq('id', 'b0000016-0000-0000-0000-000000000099');
      expect(error).toBeNull();
    });
  });

  // =========================================================================
  // Unrelated user
  // =========================================================================
  describe('unrelated user (no space membership)', () => {
    it('cannot read any data even with space_id in JWT', async () => {
      const client = userClient(UNRELATED_USER_ID, SPACE_A_ID);
      const { data } = await client.from('import_jobs').select('id');
      expect(data).toEqual([]);
    });

    it('cannot insert rows', async () => {
      const client = userClient(UNRELATED_USER_ID, SPACE_A_ID);
      const { error } = await client.from('import_jobs').insert({
        space_id: SPACE_A_ID,
        admin_id: UNRELATED_USER_ID,
        source: 'officernd',
      });
      expect(error).not.toBeNull();
    });
  });
});
