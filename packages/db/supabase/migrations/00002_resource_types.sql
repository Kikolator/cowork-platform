-- ============================================================================
-- Migration: 00002_resource_types
-- Description: Resource types and rate configuration per space
-- ============================================================================

-- ==========================================================================
-- 1. Tables
-- ==========================================================================

-- 1a. resource_types
CREATE TABLE resource_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id   uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  slug       text NOT NULL,
  name       text NOT NULL,
  bookable   boolean DEFAULT true,
  billable   boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(space_id, slug)
);

-- 1b. rate_config
CREATE TABLE rate_config (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id         uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  resource_type_id uuid NOT NULL REFERENCES resource_types(id) ON DELETE CASCADE,
  rate_cents       integer NOT NULL,
  currency         text NOT NULL DEFAULT 'eur',
  iva_rate         numeric NOT NULL DEFAULT 21,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(space_id, resource_type_id)
);

-- ==========================================================================
-- 2. RLS policies
-- ==========================================================================

-- 2a. resource_types
ALTER TABLE resource_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON resource_types
  FOR SELECT USING (
    space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON resource_types
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON resource_types
  FOR ALL USING (is_platform_admin(auth.uid()));

-- 2b. rate_config
ALTER TABLE rate_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON rate_config
  FOR SELECT USING (
    space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON rate_config
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON rate_config
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 3. Indexes
-- ==========================================================================

CREATE INDEX idx_rate_config_resource_type_id ON rate_config(resource_type_id);

-- ==========================================================================
-- 4. updated_at triggers
-- ==========================================================================

CREATE TRIGGER set_resource_types_updated_at
  BEFORE UPDATE ON resource_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_rate_config_updated_at
  BEFORE UPDATE ON rate_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 5. Rollback
-- ==========================================================================
-- DROP TRIGGER IF EXISTS set_rate_config_updated_at ON rate_config;
-- DROP TRIGGER IF EXISTS set_resource_types_updated_at ON resource_types;
-- DROP POLICY IF EXISTS "platform_admins_full" ON rate_config;
-- DROP POLICY IF EXISTS "space_admins_manage" ON rate_config;
-- DROP POLICY IF EXISTS "public_read" ON rate_config;
-- DROP POLICY IF EXISTS "platform_admins_full" ON resource_types;
-- DROP POLICY IF EXISTS "space_admins_manage" ON resource_types;
-- DROP POLICY IF EXISTS "public_read" ON resource_types;
-- DROP TABLE IF EXISTS rate_config;
-- DROP TABLE IF EXISTS resource_types;
