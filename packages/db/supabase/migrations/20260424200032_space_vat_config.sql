-- Add space-level VAT/IVA configuration
-- Enables tax rate display on Stripe invoices via TaxRate objects

ALTER TABLE spaces
  ADD COLUMN default_iva_rate   numeric NOT NULL DEFAULT 21
    CHECK (default_iva_rate >= 0 AND default_iva_rate <= 100),
  ADD COLUMN tax_inclusive      boolean NOT NULL DEFAULT true,
  ADD COLUMN stripe_tax_rate_id text;

COMMENT ON COLUMN spaces.default_iva_rate IS
  'Default VAT/IVA percentage applied to plans and products. Used when creating Stripe TaxRate objects.';
COMMENT ON COLUMN spaces.tax_inclusive IS
  'When true, price_cents on plans/products includes tax. When false, tax is added on top.';
COMMENT ON COLUMN spaces.stripe_tax_rate_id IS
  'Cached Stripe TaxRate ID on the connected account. Cleared when rate or inclusive setting changes.';

-- Rollback:
-- ALTER TABLE spaces DROP COLUMN IF EXISTS stripe_tax_rate_id;
-- ALTER TABLE spaces DROP COLUMN IF EXISTS tax_inclusive;
-- ALTER TABLE spaces DROP COLUMN IF EXISTS default_iva_rate;
