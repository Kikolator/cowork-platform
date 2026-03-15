-- ==========================================================================
-- E2E Test Seed Data
-- ==========================================================================
-- Deterministic UUIDs for test fixtures. Referenced by apps/web/e2e/global-setup.ts.

INSERT INTO tenants (id, name, slug, status)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Test Tenant',
  'test-tenant',
  'active'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO spaces (id, tenant_id, name, slug, active)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Test Space',
  'test-space',
  true
)
ON CONFLICT (tenant_id, slug) DO NOTHING;
