-- ============================================================================
-- Migration: 00010_leads
-- Description: Lead tracking and CRM pipeline per space
-- ============================================================================

-- ==========================================================================
-- 1. Tables
-- ==========================================================================

CREATE TABLE leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id          uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  email             text NOT NULL,
  full_name         text,
  phone             text,
  company           text,
  status            lead_status NOT NULL DEFAULT 'new',
  source            text DEFAULT 'website',
  trial_date        date,
  trial_confirmed   boolean DEFAULT false,
  converted_user_id uuid REFERENCES auth.users(id),
  last_contacted_at timestamptz,
  follow_up_count   integer DEFAULT 0,
  admin_notes       text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  archived_at       timestamptz
);

-- ==========================================================================
-- 2. RLS policies
-- ==========================================================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "space_admins_manage" ON leads
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON leads
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 3. Indexes
-- ==========================================================================

CREATE INDEX idx_leads_space_id ON leads(space_id);
CREATE INDEX idx_leads_status   ON leads(space_id, status);
CREATE INDEX idx_leads_email    ON leads(space_id, email);

-- ==========================================================================
-- 4. updated_at triggers
-- ==========================================================================

CREATE TRIGGER set_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 5. Rollback
-- ==========================================================================
-- DROP TRIGGER IF EXISTS set_leads_updated_at ON leads;
-- DROP POLICY IF EXISTS "platform_admins_full" ON leads;
-- DROP POLICY IF EXISTS "space_admins_manage" ON leads;
-- DROP TABLE IF EXISTS leads;
