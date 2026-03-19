-- Add configurable minimum booking duration per space
-- Default 60 minutes (1 hour). Operators can lower to e.g. 15 min.
--
-- Rollback: ALTER TABLE spaces DROP COLUMN min_booking_minutes;

ALTER TABLE spaces
  ADD COLUMN min_booking_minutes integer NOT NULL DEFAULT 60;

COMMENT ON COLUMN spaces.min_booking_minutes IS
  'Minimum booking duration in minutes. Default 60 (1 hour). Configurable by operator.';
