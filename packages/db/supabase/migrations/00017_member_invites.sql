-- 00017_member_invites.sql
-- Add invite tracking and login tracking columns
-- ==========================================================================

-- 1. Track when a member was last sent an invite email
ALTER TABLE members ADD COLUMN invited_at timestamptz;

-- 2. Track when a user last completed the auth callback (login)
ALTER TABLE shared_profiles ADD COLUMN last_login_at timestamptz;

-- ==========================================================================
-- Rollback
-- ==========================================================================
-- ALTER TABLE shared_profiles DROP COLUMN IF EXISTS last_login_at;
-- ALTER TABLE members DROP COLUMN IF EXISTS invited_at;
