/**
 * RLS Tests: Foundation Tables
 *
 * Tests for: tenants, spaces, shared_profiles, space_users, platform_admins
 * These tables have special/unique RLS policy patterns.
 */

import { describe, it, expect } from 'vitest';
import {
  serviceClient,
  anonClient,
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
  UNRELATED_USER_ID,
} from './helpers';

// =========================================================================
// tenants
// =========================================================================
describe('tenants', () => {
  describe('anon', () => {
    it('cannot read tenants', async () => {
      const client = anonClient();
      const { data } = await client.from('tenants').select('id');
      expect(data).toEqual([]);
    });
  });

  describe('platform admin', () => {
    it('can read all tenants', async () => {
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client.from('tenants').select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
    });

    it('can update any tenant', async () => {
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { error } = await client
        .from('tenants')
        .update({ billing_email: 'updated@test.com' })
        .eq('id', TENANT_B_ID);
      expect(error).toBeNull();
    });

    it('can insert a tenant', async () => {
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { error } = await client.from('tenants').insert({
        name: 'Platform Admin Test Tenant',
        slug: 'pa-test-tenant',
        status: 'trial',
      });
      expect(error).toBeNull();
      // Clean up
      const svc = serviceClient();
      await svc.from('tenants').delete().eq('slug', 'pa-test-tenant');
    });

    it('can delete a tenant', async () => {
      const svc = serviceClient();
      await svc.from('tenants').insert({
        id: '99999999-9999-9999-9999-999999999999',
        name: 'Delete Me',
        slug: 'delete-me',
        status: 'trial',
      });
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { error } = await client
        .from('tenants')
        .delete()
        .eq('id', '99999999-9999-9999-9999-999999999999');
      expect(error).toBeNull();
    });
  });

  describe('space admin', () => {
    it('can read own tenant (Space A admin reads Tenant A)', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client
        .from('tenants')
        .select('id')
        .eq('id', TENANT_ID);
      expect(error).toBeNull();
      expect(data!.length).toBe(1);
    });

    it('cannot read other tenants (Space A admin cannot read Tenant B)', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data } = await client
        .from('tenants')
        .select('id')
        .eq('id', TENANT_B_ID);
      expect(data).toEqual([]);
    });

    it('cannot insert tenants', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client.from('tenants').insert({
        name: 'Should Fail',
        slug: 'should-fail',
      });
      expect(error).not.toBeNull();
    });

    it('cannot delete tenants', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error, count } = await client
        .from('tenants')
        .delete({ count: 'exact' })
        .eq('id', TENANT_ID);
      // Either an error or 0 rows affected
      if (error === null) {
        expect(count).toBe(0);
      }
    });
  });

  describe('space owner', () => {
    it('can update own tenant', async () => {
      // First promote space_a_admin to owner
      const svc = serviceClient();
      await svc
        .from('space_users')
        .update({ role: 'owner' })
        .eq('user_id', SPACE_A_ADMIN_ID)
        .eq('space_id', SPACE_A_ID);

      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client
        .from('tenants')
        .update({ billing_email: 'owner-update@test.com' })
        .eq('id', TENANT_ID);
      expect(error).toBeNull();

      // Restore to admin
      await svc
        .from('space_users')
        .update({ role: 'admin' })
        .eq('user_id', SPACE_A_ADMIN_ID)
        .eq('space_id', SPACE_A_ID);
    });
  });

  describe('regular member', () => {
    it('cannot read any tenants', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client.from('tenants').select('id');
      expect(data).toEqual([]);
    });
  });
});

// =========================================================================
// spaces
// =========================================================================
describe('spaces', () => {
  describe('anon', () => {
    it('can read active spaces (public_read_active_spaces)', async () => {
      const client = anonClient();
      const { data, error } = await client
        .from('spaces')
        .select('id')
        .eq('active', true);
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
    });

    it('cannot read inactive spaces', async () => {
      // Create an inactive space via service client
      const svc = serviceClient();
      await svc.from('spaces').insert({
        id: '55555555-5555-5555-5555-555555555555',
        tenant_id: TENANT_ID,
        name: 'Inactive Space',
        slug: 'inactive-space',
        active: false,
      });

      const client = anonClient();
      const { data } = await client
        .from('spaces')
        .select('id')
        .eq('id', '55555555-5555-5555-5555-555555555555');
      expect(data).toEqual([]);

      // Clean up
      await svc
        .from('spaces')
        .delete()
        .eq('id', '55555555-5555-5555-5555-555555555555');
    });

    it('cannot insert spaces', async () => {
      const client = anonClient();
      const { error } = await client.from('spaces').insert({
        tenant_id: TENANT_ID,
        name: 'Anon Space',
        slug: 'anon-space',
      });
      expect(error).not.toBeNull();
    });
  });

  describe('platform admin', () => {
    it('can read all spaces (including inactive)', async () => {
      const svc = serviceClient();
      await svc.from('spaces').insert({
        id: '55555555-5555-5555-5555-555555555555',
        tenant_id: TENANT_ID,
        name: 'Inactive Space',
        slug: 'inactive-space',
        active: false,
      });

      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { data } = await client
        .from('spaces')
        .select('id')
        .eq('id', '55555555-5555-5555-5555-555555555555');
      expect(data!.length).toBe(1);

      await svc
        .from('spaces')
        .delete()
        .eq('id', '55555555-5555-5555-5555-555555555555');
    });

    it('can create and delete spaces', async () => {
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { error: insertError } = await client.from('spaces').insert({
        id: '66666666-6666-6666-6666-666666666666',
        tenant_id: TENANT_ID,
        name: 'PA Test Space',
        slug: 'pa-test-space',
      });
      expect(insertError).toBeNull();

      const { error: deleteError } = await client
        .from('spaces')
        .delete()
        .eq('id', '66666666-6666-6666-6666-666666666666');
      expect(deleteError).toBeNull();
    });
  });

  describe('space admin', () => {
    it('can manage own space (with matching space_id in JWT)', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { error } = await client
        .from('spaces')
        .update({ primary_color: '#ff0000' })
        .eq('id', SPACE_A_ID);
      expect(error).toBeNull();
    });

    it('cannot manage another space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client
        .from('spaces')
        .update({ primary_color: '#ff0000' })
        .eq('id', SPACE_B_ID)
        .select();
      // Update should affect 0 rows (no error, but no match)
      if (error === null) {
        expect(data).toEqual([]);
      }
    });

    it('cannot manage own space with wrong JWT space_id', async () => {
      // Space A admin with Space B in JWT
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_B_ID);
      const { data } = await client
        .from('spaces')
        .update({ primary_color: '#00ff00' })
        .eq('id', SPACE_A_ID)
        .select();
      expect(data).toEqual([]);
    });
  });

  describe('regular member', () => {
    it('can read active spaces (public read)', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data, error } = await client
        .from('spaces')
        .select('id')
        .eq('id', SPACE_A_ID);
      expect(error).toBeNull();
      expect(data!.length).toBe(1);
    });

    it('cannot update spaces', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client
        .from('spaces')
        .update({ name: 'Hacked' })
        .eq('id', SPACE_A_ID)
        .select();
      expect(data).toEqual([]);
    });
  });
});

// =========================================================================
// shared_profiles
// =========================================================================
describe('shared_profiles', () => {
  describe('anon', () => {
    it('cannot read any profiles', async () => {
      const client = anonClient();
      const { data } = await client.from('shared_profiles').select('id');
      expect(data).toEqual([]);
    });
  });

  describe('authenticated user', () => {
    it('can read own profile', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data, error } = await client
        .from('shared_profiles')
        .select('id, email')
        .eq('id', SPACE_A_MEMBER_ID);
      expect(error).toBeNull();
      expect(data!.length).toBe(1);
      expect(data![0].id).toBe(SPACE_A_MEMBER_ID);
    });

    it('cannot read another user profile directly', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client
        .from('shared_profiles')
        .select('id')
        .eq('id', SPACE_B_MEMBER_ID);
      expect(data).toEqual([]);
    });

    it('can update own profile', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { error } = await client
        .from('shared_profiles')
        .update({ full_name: 'Updated Name' })
        .eq('id', SPACE_A_MEMBER_ID);
      expect(error).toBeNull();
    });

    it('cannot update another user profile', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client
        .from('shared_profiles')
        .update({ full_name: 'Hacked Name' })
        .eq('id', SPACE_B_MEMBER_ID)
        .select();
      expect(data).toEqual([]);
    });
  });

  describe('space admin', () => {
    it('can read profiles of users in their space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client
        .from('shared_profiles')
        .select('id')
        .eq('id', SPACE_A_MEMBER_ID);
      expect(error).toBeNull();
      expect(data!.length).toBe(1);
    });

    it('cannot read profiles of users in another space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data } = await client
        .from('shared_profiles')
        .select('id')
        .eq('id', SPACE_B_MEMBER_ID);
      expect(data).toEqual([]);
    });
  });

  describe('platform admin', () => {
    it('can read all profiles', async () => {
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client
        .from('shared_profiles')
        .select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(6);
    });
  });
});

// =========================================================================
// space_users
// =========================================================================
describe('space_users', () => {
  describe('anon', () => {
    it('cannot read space_users', async () => {
      const client = anonClient();
      const { data } = await client.from('space_users').select('id');
      expect(data).toEqual([]);
    });
  });

  describe('regular member', () => {
    it('can read own space_users entry (across all spaces)', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data, error } = await client
        .from('space_users')
        .select('id, role')
        .eq('user_id', SPACE_A_MEMBER_ID);
      expect(error).toBeNull();
      expect(data!.length).toBe(1);
      expect(data![0].role).toBe('member');
    });

    it('cannot read other users space_users entries', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client
        .from('space_users')
        .select('id')
        .eq('user_id', SPACE_B_MEMBER_ID);
      expect(data).toEqual([]);
    });

    it('cannot insert space_users', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { error } = await client.from('space_users').insert({
        user_id: UNRELATED_USER_ID,
        space_id: SPACE_A_ID,
        role: 'admin',
      });
      expect(error).not.toBeNull();
    });

    it('cannot update space_users', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client
        .from('space_users')
        .update({ role: 'admin' })
        .eq('user_id', SPACE_A_MEMBER_ID)
        .eq('space_id', SPACE_A_ID)
        .select();
      expect(data).toEqual([]);
    });

    it('cannot delete space_users', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client
        .from('space_users')
        .delete()
        .eq('user_id', SPACE_A_MEMBER_ID)
        .eq('space_id', SPACE_A_ID)
        .select();
      expect(data).toEqual([]);
    });
  });

  describe('space admin', () => {
    it('can manage space_users in own space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client
        .from('space_users')
        .select('id, role')
        .eq('space_id', SPACE_A_ID);
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
    });

    it('cannot manage space_users in another space', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data } = await client
        .from('space_users')
        .select('id')
        .eq('space_id', SPACE_B_ID);
      expect(data).toEqual([]);
    });
  });

  describe('platform admin', () => {
    it('can read all space_users', async () => {
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client.from('space_users').select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(4);
    });
  });
});

// =========================================================================
// platform_admins
// =========================================================================
describe('platform_admins', () => {
  describe('anon', () => {
    it('cannot read platform_admins', async () => {
      const client = anonClient();
      const { data } = await client.from('platform_admins').select('id');
      expect(data).toEqual([]);
    });
  });

  describe('regular member', () => {
    it('cannot read platform_admins', async () => {
      const client = userClient(SPACE_A_MEMBER_ID, SPACE_A_ID);
      const { data } = await client.from('platform_admins').select('id');
      expect(data).toEqual([]);
    });
  });

  describe('space admin', () => {
    it('cannot read platform_admins', async () => {
      const client = userClient(SPACE_A_ADMIN_ID, SPACE_A_ID);
      const { data } = await client.from('platform_admins').select('id');
      expect(data).toEqual([]);
    });
  });

  describe('platform admin', () => {
    it('can read platform_admins', async () => {
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { data, error } = await client
        .from('platform_admins')
        .select('id, user_id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('can insert into platform_admins', async () => {
      const client = userClient(PLATFORM_ADMIN_ID, SPACE_A_ID);
      const { error } = await client.from('platform_admins').insert({
        user_id: UNRELATED_USER_ID,
      });
      expect(error).toBeNull();

      // Clean up
      const svc = serviceClient();
      await svc
        .from('platform_admins')
        .delete()
        .eq('user_id', UNRELATED_USER_ID);
    });
  });
});

// =========================================================================
// service_role bypass
// =========================================================================
describe('service_role bypass', () => {
  it('can read all data in any table regardless of RLS', async () => {
    const svc = serviceClient();
    const { data: tenants } = await svc.from('tenants').select('id');
    const { data: spaces } = await svc.from('spaces').select('id');
    const { data: profiles } = await svc.from('shared_profiles').select('id');
    const { data: spaceUsers } = await svc.from('space_users').select('id');
    const { data: admins } = await svc.from('platform_admins').select('id');

    expect(tenants!.length).toBeGreaterThanOrEqual(2);
    expect(spaces!.length).toBeGreaterThanOrEqual(2);
    expect(profiles!.length).toBeGreaterThanOrEqual(6);
    expect(spaceUsers!.length).toBeGreaterThanOrEqual(4);
    expect(admins!.length).toBeGreaterThanOrEqual(1);
  });
});
