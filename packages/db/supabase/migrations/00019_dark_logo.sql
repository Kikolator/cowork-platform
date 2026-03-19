-- Add dark mode logo URL to spaces
-- Rollback: ALTER TABLE spaces DROP COLUMN logo_dark_url;

ALTER TABLE spaces ADD COLUMN logo_dark_url text;
