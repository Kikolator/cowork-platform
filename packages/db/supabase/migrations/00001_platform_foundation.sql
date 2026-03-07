-- ============================================================================
-- Migration: 00001_platform_foundation
-- Description: Core platform tables, enums, functions, and RLS policies
-- ============================================================================

-- ==========================================================================
-- 1. Extensions
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist SCHEMA extensions;

-- ==========================================================================
-- 2. Enums (universal status / type enums)
-- ==========================================================================

CREATE TYPE member_status AS ENUM (
  'active', 'paused', 'past_due', 'cancelling', 'churned'
);

CREATE TYPE booking_status AS ENUM (
  'pending_payment', 'confirmed', 'checked_in', 'completed',
  'cancelled', 'no_show'
);

CREATE TYPE pass_status AS ENUM (
  'pending_payment', 'active', 'used', 'cancelled', 'expired'
);

CREATE TYPE lead_status AS ENUM (
  'new', 'invited', 'confirmed', 'completed', 'follow_up', 'converted', 'lost'
);

CREATE TYPE pass_type AS ENUM ('day', 'week');

CREATE TYPE fiscal_id_type AS ENUM (
  'nif', 'nie', 'passport', 'cif',
  'eu_vat', 'foreign_tax_id', 'other'
);

CREATE TYPE credit_grant_source AS ENUM (
  'subscription', 'purchase', 'manual', 'refund'
);

CREATE TYPE product_category AS ENUM (
  'subscription', 'pass', 'hour_bundle', 'addon', 'deposit', 'event'
);

CREATE TYPE resource_status AS ENUM (
  'available', 'occupied', 'out_of_service'
);

CREATE TYPE recurrence_pattern AS ENUM (
  'daily', 'weekly', 'biweekly'
);

-- ==========================================================================
-- 3. Trigger function: set_updated_at
-- ==========================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ==========================================================================
-- 4. Security / helper functions
-- ==========================================================================

-- Verify caller has access to the space (used at top of every SECURITY DEFINER function)
CREATE FUNCTION verify_space_access(p_space_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'space_id')::uuid IS DISTINCT FROM p_space_id
     AND NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  THEN
    RAISE EXCEPTION 'Space access denied' USING ERRCODE = 'P0003';
  END IF;
END;
$$;

-- Check if user is admin/owner of a space
CREATE FUNCTION is_space_admin(p_user_id uuid, p_space_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM space_users
    WHERE user_id = p_user_id
      AND space_id = p_space_id
      AND role IN ('admin', 'owner')
  );
END;
$$;

-- Check if user is a platform superadmin
CREATE FUNCTION is_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM platform_admins WHERE user_id = p_user_id
  );
END;
$$;

-- ==========================================================================
-- 5. Tables
-- ==========================================================================

-- 5a. tenants
CREATE TABLE tenants (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        text NOT NULL,
  slug                        text NOT NULL UNIQUE,
  status                      text NOT NULL DEFAULT 'trial'
                              CHECK (status IN ('trial', 'active', 'suspended', 'churned')),
  -- Stripe Connect
  stripe_account_id           text UNIQUE,
  stripe_onboarding_complete  boolean DEFAULT false,
  -- Platform billing (what the tenant pays us)
  platform_plan               text NOT NULL DEFAULT 'free'
                              CHECK (platform_plan IN ('free', 'pro', 'enterprise')),
  platform_subscription_id    text,
  trial_ends_at               timestamptz,
  -- Billing contact
  billing_email               text,
  billing_name                text,
  -- Metadata
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

-- 5b. spaces
CREATE TABLE spaces (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                      text NOT NULL,
  slug                      text NOT NULL,
  -- Branding
  logo_url                  text,
  favicon_url               text,
  primary_color             text DEFAULT '#000000',
  accent_color              text DEFAULT '#3b82f6',
  -- Location
  address                   text,
  city                      text,
  country_code              text NOT NULL DEFAULT 'ES',
  timezone                  text NOT NULL DEFAULT 'Europe/Madrid',
  -- Operations
  business_hours            jsonb NOT NULL DEFAULT '{
    "mon": {"open": "09:00", "close": "18:00"},
    "tue": {"open": "09:00", "close": "18:00"},
    "wed": {"open": "09:00", "close": "18:00"},
    "thu": {"open": "09:00", "close": "18:00"},
    "fri": {"open": "09:00", "close": "18:00"},
    "sat": null,
    "sun": null
  }',
  currency                  text NOT NULL DEFAULT 'eur',
  default_locale            text NOT NULL DEFAULT 'en'
                            CHECK (default_locale IN ('en', 'es', 'de', 'fr', 'pt', 'nl')),
  -- Feature flags
  features                  jsonb NOT NULL DEFAULT '{
    "passes": true,
    "credits": true,
    "leads": true,
    "recurring_bookings": true,
    "guest_passes": true
  }',
  -- Domain
  custom_domain             text UNIQUE,
  -- Fiscal config
  require_fiscal_id         boolean DEFAULT false,
  supported_fiscal_id_types jsonb DEFAULT '["nif", "nie", "passport", "cif"]',
  -- Status
  active                    boolean DEFAULT true,
  -- Metadata
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- 5c. shared_profiles
CREATE TABLE shared_profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL,
  full_name       text,
  phone           text,
  avatar_url      text,
  preferred_lang  text DEFAULT 'en' CHECK (preferred_lang IN ('en', 'es', 'de', 'fr', 'pt', 'nl')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 5d. space_users
CREATE TABLE space_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id   uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member'
             CHECK (role IN ('member', 'admin', 'owner')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, space_id)
);

-- 5e. platform_admins
CREATE TABLE platform_admins (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- ==========================================================================
-- 6. Auth trigger: auto-create shared_profiles on signup
-- ==========================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO shared_profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ==========================================================================
-- 7. RLS policies
-- ==========================================================================

-- 7a. tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_full" ON tenants
  FOR ALL USING (is_platform_admin(auth.uid()));

CREATE POLICY "space_admins_read_own_tenant" ON tenants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM spaces s
      JOIN space_users su ON su.space_id = s.id
      WHERE s.tenant_id = tenants.id
        AND su.user_id = auth.uid()
        AND su.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "space_owners_update_own_tenant" ON tenants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM spaces s
      JOIN space_users su ON su.space_id = s.id
      WHERE s.tenant_id = tenants.id
        AND su.user_id = auth.uid()
        AND su.role = 'owner'
    )
  );

-- 7b. spaces
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_active_spaces" ON spaces
  FOR SELECT USING (active = true);

CREATE POLICY "space_admins_manage" ON spaces
  FOR ALL USING (
    is_space_admin(auth.uid(), id)
    AND id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON spaces
  FOR ALL USING (is_platform_admin(auth.uid()));

-- 7c. shared_profiles
ALTER TABLE shared_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON shared_profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_update_own" ON shared_profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "space_admins_read_space_profiles" ON shared_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM space_users su
      WHERE su.user_id = shared_profiles.id
        AND su.space_id = (auth.jwt() ->> 'space_id')::uuid
    )
    AND is_space_admin(auth.uid(), (auth.jwt() ->> 'space_id')::uuid)
  );

CREATE POLICY "platform_admins_full" ON shared_profiles
  FOR ALL USING (is_platform_admin(auth.uid()));

-- 7d. space_users
ALTER TABLE space_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON space_users
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "space_admins_manage" ON space_users
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON space_users
  FOR ALL USING (is_platform_admin(auth.uid()));

-- 7e. platform_admins
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_only" ON platform_admins
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 8. Indexes
-- ==========================================================================

CREATE INDEX idx_spaces_tenant_id ON spaces(tenant_id);
CREATE INDEX idx_shared_profiles_email ON shared_profiles(email);
CREATE INDEX idx_space_users_space_id ON space_users(space_id);
CREATE INDEX idx_space_users_user_id ON space_users(user_id);

-- ==========================================================================
-- 9. updated_at triggers
-- ==========================================================================

CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_spaces_updated_at
  BEFORE UPDATE ON spaces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_shared_profiles_updated_at
  BEFORE UPDATE ON shared_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_space_users_updated_at
  BEFORE UPDATE ON space_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 10. Rollback
-- ==========================================================================
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP TRIGGER IF EXISTS set_space_users_updated_at ON space_users;
-- DROP TRIGGER IF EXISTS set_shared_profiles_updated_at ON shared_profiles;
-- DROP TRIGGER IF EXISTS set_spaces_updated_at ON spaces;
-- DROP TRIGGER IF EXISTS set_tenants_updated_at ON tenants;
-- DROP POLICY IF EXISTS "platform_admins_only" ON platform_admins;
-- DROP POLICY IF EXISTS "platform_admins_full" ON space_users;
-- DROP POLICY IF EXISTS "space_admins_manage" ON space_users;
-- DROP POLICY IF EXISTS "users_read_own" ON space_users;
-- DROP POLICY IF EXISTS "platform_admins_full" ON shared_profiles;
-- DROP POLICY IF EXISTS "space_admins_read_space_profiles" ON shared_profiles;
-- DROP POLICY IF EXISTS "users_update_own" ON shared_profiles;
-- DROP POLICY IF EXISTS "users_read_own" ON shared_profiles;
-- DROP POLICY IF EXISTS "platform_admins_full" ON spaces;
-- DROP POLICY IF EXISTS "space_admins_manage" ON spaces;
-- DROP POLICY IF EXISTS "public_read_active_spaces" ON spaces;
-- DROP POLICY IF EXISTS "space_owners_update_own_tenant" ON tenants;
-- DROP POLICY IF EXISTS "space_admins_read_own_tenant" ON tenants;
-- DROP POLICY IF EXISTS "platform_admins_full" ON tenants;
-- DROP TABLE IF EXISTS platform_admins;
-- DROP TABLE IF EXISTS space_users;
-- DROP TABLE IF EXISTS shared_profiles;
-- DROP TABLE IF EXISTS spaces;
-- DROP TABLE IF EXISTS tenants;
-- DROP FUNCTION IF EXISTS handle_new_user();
-- DROP FUNCTION IF EXISTS is_platform_admin(uuid);
-- DROP FUNCTION IF EXISTS is_space_admin(uuid, uuid);
-- DROP FUNCTION IF EXISTS verify_space_access(uuid);
-- DROP FUNCTION IF EXISTS set_updated_at();
-- DROP TYPE IF EXISTS recurrence_pattern;
-- DROP TYPE IF EXISTS resource_status;
-- DROP TYPE IF EXISTS product_category;
-- DROP TYPE IF EXISTS credit_grant_source;
-- DROP TYPE IF EXISTS fiscal_id_type;
-- DROP TYPE IF EXISTS pass_type;
-- DROP TYPE IF EXISTS lead_status;
-- DROP TYPE IF EXISTS pass_status;
-- DROP TYPE IF EXISTS booking_status;
-- DROP TYPE IF EXISTS member_status;
-- DROP EXTENSION IF EXISTS btree_gist;
