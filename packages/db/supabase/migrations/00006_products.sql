-- ============================================================================
-- Migration: 00006_products
-- Description: Store catalogue (products) per space
-- ============================================================================

-- ==========================================================================
-- 1. Tables
-- ==========================================================================

CREATE TABLE products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id            uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name                text NOT NULL,
  slug                text NOT NULL,
  description         text,
  category            product_category NOT NULL,
  -- Checkout behavior
  purchase_flow       text NOT NULL DEFAULT 'checkout'
                      CHECK (purchase_flow IN (
                        'checkout', 'subscription', 'date_picker', 'subscription_addon'
                      )),
  -- Pricing
  price_cents         integer NOT NULL,
  iva_rate            numeric NOT NULL DEFAULT 21,
  currency            text NOT NULL DEFAULT 'eur',
  -- Stripe
  stripe_price_id     text,
  stripe_product_id   text,
  -- Links to plan (for subscription products)
  plan_id             uuid REFERENCES plans(id),
  -- Hour bundle fulfillment
  -- { "resource_type_id": "uuid", "minutes": 600 }
  credit_grant_config jsonb,
  -- Visibility
  -- {
  --   "require_membership": true,
  --   "require_no_membership": true,
  --   "require_plan_ids": ["uuid", "uuid"],
  --   "exclude_unlimited": true
  -- }
  visibility_rules    jsonb NOT NULL DEFAULT '{}',
  -- Status
  active              boolean DEFAULT true,
  sort_order          integer DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE(space_id, slug)
);

-- ==========================================================================
-- 2. RLS policies
-- ==========================================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON products
  FOR SELECT USING (
    space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "space_admins_manage" ON products
  FOR ALL USING (
    is_space_admin(auth.uid(), space_id)
    AND space_id = (auth.jwt() ->> 'space_id')::uuid
  );

CREATE POLICY "platform_admins_full" ON products
  FOR ALL USING (is_platform_admin(auth.uid()));

-- ==========================================================================
-- 3. Indexes
-- ==========================================================================

CREATE INDEX idx_products_space_id ON products(space_id);
CREATE INDEX idx_products_plan_id ON products(plan_id) WHERE plan_id IS NOT NULL;

-- ==========================================================================
-- 4. updated_at triggers
-- ==========================================================================

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 5. Rollback
-- ==========================================================================
-- DROP TRIGGER IF EXISTS set_products_updated_at ON products;
-- DROP POLICY IF EXISTS "platform_admins_full" ON products;
-- DROP POLICY IF EXISTS "space_admins_manage" ON products;
-- DROP POLICY IF EXISTS "public_read" ON products;
-- DROP TABLE IF EXISTS products;
