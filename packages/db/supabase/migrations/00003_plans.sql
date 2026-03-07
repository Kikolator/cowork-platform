-- ============================================================================
-- Migration: 00003_plans
-- Description: Plans and plan credit configuration per space
-- ============================================================================

-- ==========================================================================
-- 1. Tables
-- ==========================================================================

-- 1a. plans
CREATE TABLE plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id            uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name                text NOT NULL,
  slug                text NOT NULL,
  description         text,
  -- Pricing
  price_cents         integer NOT NULL,
  currency            text NOT NULL DEFAULT 'eur',
  iva_rate            numeric NOT NULL DEFAULT 21,
  -- Stripe
  stripe_price_id     text,
  stripe_product_id   text,
  -- Access control (replaces access_level enum)
  access_type         text NOT NULL DEFAULT 'business_hours'
                      CHECK (access_type IN ('none', 'business_hours', 'extended', 'twenty_four_seven')),
  has_fixed_desk      boolean DEFAULT false,
  -- Display
  sort_order          integer DEFAULT 0,
  active              boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE(space_id, slug)
);

-- 1b. plan_credit_config
CREATE TABLE plan_credit_config (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id         uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  plan_id          uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  resource_type_id uuid NOT NULL REFERENCES resource_types(id) ON DELETE CASCADE,
  monthly_minutes  integer NOT NULL DEFAULT 0 CHECK (monthly_minutes >= 0),
  is_unlimited     boolean NOT NULL DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(plan_id, resource_type_id)
);

-- ==========================================================================
-- 2. RLS policies
-- ==========================================================================

-- 2a. plans
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON plans
  FOR SELECT USING (
    space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON plans
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON plans
  FOR ALL USING (is_platform_admin(auth.uid()));

-- 2b. plan_credit_config
ALTER TABLE plan_credit_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON plan_credit_config
  FOR SELECT USING (
    space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON plan_credit_config
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON plan_credit_config
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 3. Indexes
-- ==========================================================================

CREATE INDEX idx_plan_credit_config_plan_id ON plan_credit_config(plan_id);
CREATE INDEX idx_plan_credit_config_resource_type_id ON plan_credit_config(resource_type_id);

-- ==========================================================================
-- 4. updated_at triggers
-- ==========================================================================

CREATE TRIGGER set_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_plan_credit_config_updated_at
  BEFORE UPDATE ON plan_credit_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 5. Rollback
-- ==========================================================================
-- DROP TRIGGER IF EXISTS set_plan_credit_config_updated_at ON plan_credit_config;
-- DROP TRIGGER IF EXISTS set_plans_updated_at ON plans;
-- DROP POLICY IF EXISTS "platform_admins_full" ON plan_credit_config;
-- DROP POLICY IF EXISTS "space_admins_manage" ON plan_credit_config;
-- DROP POLICY IF EXISTS "public_read" ON plan_credit_config;
-- DROP POLICY IF EXISTS "platform_admins_full" ON plans;
-- DROP POLICY IF EXISTS "space_admins_manage" ON plans;
-- DROP POLICY IF EXISTS "public_read" ON plans;
-- DROP TABLE IF EXISTS plan_credit_config;
-- DROP TABLE IF EXISTS plans;
