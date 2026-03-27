-- ============================================================================
-- Migration: space_access_config
-- Description: Space-level door access code configuration and Nuki integration
-- ============================================================================

-- ==========================================================================
-- 1. Tables
-- ==========================================================================

-- 1a. space_access_config — one row per space
CREATE TABLE space_access_config (
  space_id                uuid PRIMARY KEY REFERENCES spaces(id) ON DELETE CASCADE,
  enabled                 boolean NOT NULL DEFAULT false,
  mode                    text NOT NULL DEFAULT 'manual'
                          CHECK (mode IN ('manual', 'nuki')),
  -- General codes: one per access tier
  code_business_hours     text,
  code_extended           text,
  code_twenty_four_seven  text,
  -- Nuki integration
  nuki_api_token          text,
  nuki_smartlock_id       text,
  nuki_last_sync_at       timestamptz,
  nuki_sync_error         text,
  -- Timestamps
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- 1b. Add Nuki authorization tracking to members
ALTER TABLE members
  ADD COLUMN nuki_auth_id bigint;

-- ==========================================================================
-- 2. RLS policies
-- ==========================================================================

ALTER TABLE space_access_config ENABLE ROW LEVEL SECURITY;

-- Space admins can manage their space's access config
CREATE POLICY "space_admins_manage" ON space_access_config
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

-- Members can read their space's access config (needed for /access page)
CREATE POLICY "members_read" ON space_access_config
  FOR SELECT USING (
    space_id = (auth.jwt() ->> 'space_id')::uuid
  );

-- Platform admins full access
CREATE POLICY "platform_admins_full" ON space_access_config
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 3. Indexes
-- ==========================================================================

CREATE INDEX idx_members_nuki_auth_id ON members(nuki_auth_id)
  WHERE nuki_auth_id IS NOT NULL;

-- ==========================================================================
-- 4. updated_at trigger
-- ==========================================================================

CREATE TRIGGER set_space_access_config_updated_at
  BEFORE UPDATE ON space_access_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 5. Rollback
-- ==========================================================================
-- DROP TRIGGER IF EXISTS set_space_access_config_updated_at ON space_access_config;
-- DROP POLICY IF EXISTS "platform_admins_full" ON space_access_config;
-- DROP POLICY IF EXISTS "members_read" ON space_access_config;
-- DROP POLICY IF EXISTS "space_admins_manage" ON space_access_config;
-- DROP INDEX IF EXISTS idx_members_nuki_auth_id;
-- ALTER TABLE members DROP COLUMN IF EXISTS nuki_auth_id;
-- DROP TABLE IF EXISTS space_access_config;
