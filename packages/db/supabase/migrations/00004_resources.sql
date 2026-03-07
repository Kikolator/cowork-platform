-- ============================================================================
-- Migration: 00004_resources
-- Description: Physical resources (desks, rooms, etc.) per space
-- ============================================================================

-- ==========================================================================
-- 1. Tables
-- ==========================================================================

CREATE TABLE resources (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id         uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  resource_type_id uuid NOT NULL REFERENCES resource_types(id),
  name             text NOT NULL,
  status           resource_status NOT NULL DEFAULT 'available',
  capacity         integer DEFAULT 1,
  floor            integer DEFAULT 0,
  sort_order       integer DEFAULT 0,
  metadata         jsonb DEFAULT '{}',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- ==========================================================================
-- 2. RLS policies
-- ==========================================================================

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON resources
  FOR SELECT USING (
    space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON resources
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON resources
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 3. Indexes
-- ==========================================================================

CREATE INDEX idx_resources_space_id ON resources(space_id);
CREATE INDEX idx_resources_resource_type_id ON resources(resource_type_id);

-- ==========================================================================
-- 4. updated_at triggers
-- ==========================================================================

CREATE TRIGGER set_resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 5. Rollback
-- ==========================================================================
-- DROP TRIGGER IF EXISTS set_resources_updated_at ON resources;
-- DROP POLICY IF EXISTS "platform_admins_full" ON resources;
-- DROP POLICY IF EXISTS "space_admins_manage" ON resources;
-- DROP POLICY IF EXISTS "public_read" ON resources;
-- DROP TABLE IF EXISTS resources;
