-- ============================================================================
-- Migration: 00016_import_external_ids
-- Description: Add external_id columns for data import deduplication and
--              import_jobs table for tracking import sessions
-- ============================================================================

-- ==========================================================================
-- 1. Add external_id columns to importable tables
-- ==========================================================================

-- Nullable text column on each table. Partial unique index ensures no
-- duplicate external IDs within a space while having zero cost for
-- non-imported rows (NULL values are excluded).

ALTER TABLE resource_types ADD COLUMN external_id text;
CREATE UNIQUE INDEX idx_resource_types_external_id
  ON resource_types(space_id, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE resources ADD COLUMN external_id text;
CREATE UNIQUE INDEX idx_resources_external_id
  ON resources(space_id, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE plans ADD COLUMN external_id text;
CREATE UNIQUE INDEX idx_plans_external_id
  ON plans(space_id, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE members ADD COLUMN external_id text;
CREATE UNIQUE INDEX idx_members_external_id
  ON members(space_id, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE bookings ADD COLUMN external_id text;
CREATE UNIQUE INDEX idx_bookings_external_id
  ON bookings(space_id, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE leads ADD COLUMN external_id text;
CREATE UNIQUE INDEX idx_leads_external_id
  ON leads(space_id, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE passes ADD COLUMN external_id text;
CREATE UNIQUE INDEX idx_passes_external_id
  ON passes(space_id, external_id)
  WHERE external_id IS NOT NULL;

-- ==========================================================================
-- 2. import_jobs table
-- ==========================================================================

CREATE TABLE import_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  admin_id      uuid NOT NULL REFERENCES auth.users(id),
  source        text NOT NULL DEFAULT 'officernd',
  status        text NOT NULL DEFAULT 'in_progress'
                CHECK (status IN ('in_progress', 'completed', 'failed')),
  summary       jsonb NOT NULL DEFAULT '{}',
  started_at    timestamptz DEFAULT now(),
  completed_at  timestamptz
);

-- ==========================================================================
-- 3. RLS policies for import_jobs
-- ==========================================================================

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "space_admins_manage" ON import_jobs
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON import_jobs
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 4. Indexes
-- ==========================================================================

CREATE INDEX idx_import_jobs_space_id ON import_jobs(space_id);

-- ==========================================================================
-- 5. Rollback
-- ==========================================================================
-- DROP POLICY IF EXISTS "platform_admins_full" ON import_jobs;
-- DROP POLICY IF EXISTS "space_admins_manage" ON import_jobs;
-- DROP TABLE IF EXISTS import_jobs;
-- DROP INDEX IF EXISTS idx_passes_external_id;
-- DROP INDEX IF EXISTS idx_leads_external_id;
-- DROP INDEX IF EXISTS idx_bookings_external_id;
-- DROP INDEX IF EXISTS idx_members_external_id;
-- DROP INDEX IF EXISTS idx_plans_external_id;
-- DROP INDEX IF EXISTS idx_resources_external_id;
-- DROP INDEX IF EXISTS idx_resource_types_external_id;
-- ALTER TABLE passes DROP COLUMN IF EXISTS external_id;
-- ALTER TABLE leads DROP COLUMN IF EXISTS external_id;
-- ALTER TABLE bookings DROP COLUMN IF EXISTS external_id;
-- ALTER TABLE members DROP COLUMN IF EXISTS external_id;
-- ALTER TABLE plans DROP COLUMN IF EXISTS external_id;
-- ALTER TABLE resources DROP COLUMN IF EXISTS external_id;
-- ALTER TABLE resource_types DROP COLUMN IF EXISTS external_id;
