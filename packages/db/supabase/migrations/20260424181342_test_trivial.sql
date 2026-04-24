-- Trivial migration to test verify-db-types CI job
-- This adds a comment column that will change the generated types
-- but we intentionally do NOT regenerate types/database.ts

ALTER TABLE event_types ADD COLUMN IF NOT EXISTS test_column text;
