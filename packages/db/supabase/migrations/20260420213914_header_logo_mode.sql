ALTER TABLE spaces ADD COLUMN header_logo_mode text NOT NULL DEFAULT 'icon_and_name'
  CHECK (header_logo_mode IN ('icon_and_name', 'logo_only'));

-- Rollback: ALTER TABLE spaces DROP COLUMN header_logo_mode;
