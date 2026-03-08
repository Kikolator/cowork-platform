-- Create test tenant
INSERT INTO tenants (id, name, slug, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Savage Coworking', 'savage-coworking', 'active');

-- Create test space
INSERT INTO spaces (id, tenant_id, name, slug, timezone, currency, country_code, features)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Savage Coworking',
  'savage',
  'Europe/Madrid',
  'eur',
  'ES',
  '{"passes": true, "credits": true, "leads": true, "recurring_bookings": true, "guest_passes": true, "open_registration": true}'
);