-- ============================================================================
-- Migration: 00005_members
-- Description: Space-scoped memberships and admin note timeline
-- ============================================================================

-- ==========================================================================
-- 1. Tables
-- ==========================================================================

-- 1a. members
CREATE TABLE members (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id                    uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id                     uuid NOT NULL REFERENCES plans(id),
  status                      member_status NOT NULL DEFAULT 'active',
  -- Stripe (per connected account)
  stripe_customer_id          text,
  stripe_subscription_id      text UNIQUE,
  -- Desk assignment
  fixed_desk_id               uuid REFERENCES resources(id),
  -- Access
  has_twenty_four_seven       boolean DEFAULT false,
  access_code                 text,
  alarm_approved              boolean DEFAULT false,
  -- Professional context (space-specific)
  company                     text,
  role_title                  text,
  -- Fiscal / billing (space-specific — different per country/entity)
  billing_entity_type         text DEFAULT 'individual'
                              CHECK (billing_entity_type IN ('individual', 'company')),
  fiscal_id_type              fiscal_id_type,
  fiscal_id                   text,
  billing_company_name        text,
  billing_company_tax_id_type fiscal_id_type,
  billing_company_tax_id      text,
  billing_address_line1       text,
  billing_address_line2       text,
  billing_city                text,
  billing_postal_code         text,
  billing_state_province      text,
  billing_country             text DEFAULT 'ES',
  -- Dates
  joined_at                   timestamptz DEFAULT now(),
  paused_at                   timestamptz,
  cancel_requested_at         timestamptz,
  cancelled_at                timestamptz,
  -- Metadata
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now(),
  UNIQUE(space_id, user_id),
  UNIQUE(space_id, stripe_customer_id)
);

-- 1b. member_notes (append-only — no updated_at)
CREATE TABLE member_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id   uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES auth.users(id),
  content    text NOT NULL,
  category   text DEFAULT 'general'
             CHECK (category IN (
               'general', 'billing', 'access', 'incident', 'support'
             )),
  created_at timestamptz DEFAULT now()
);

-- ==========================================================================
-- 2. RLS policies
-- ==========================================================================

-- 2a. members
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON members
  FOR SELECT USING (
    user_id = auth.uid()
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON members
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON members
  FOR ALL USING (is_platform_admin(auth.uid()));

-- 2b. member_notes (admin-only — operational notes not visible to the member)
ALTER TABLE member_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "space_admins_manage" ON member_notes
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON member_notes
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 3. Indexes
-- ==========================================================================

CREATE INDEX idx_members_space_id ON members(space_id);
CREATE INDEX idx_members_user_id ON members(user_id);
CREATE INDEX idx_members_plan_id ON members(plan_id);
CREATE INDEX idx_members_status ON members(space_id, status);
CREATE INDEX idx_member_notes_member_id ON member_notes(member_id);

-- ==========================================================================
-- 4. updated_at triggers
-- ==========================================================================

CREATE TRIGGER set_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- No trigger on member_notes — append-only, no updated_at column

-- ==========================================================================
-- 5. Rollback
-- ==========================================================================
-- DROP TRIGGER IF EXISTS set_members_updated_at ON members;
-- DROP POLICY IF EXISTS "platform_admins_full" ON member_notes;
-- DROP POLICY IF EXISTS "space_admins_manage" ON member_notes;
-- DROP POLICY IF EXISTS "platform_admins_full" ON members;
-- DROP POLICY IF EXISTS "space_admins_manage" ON members;
-- DROP POLICY IF EXISTS "users_read_own" ON members;
-- DROP TABLE IF EXISTS member_notes;
-- DROP TABLE IF EXISTS members;
