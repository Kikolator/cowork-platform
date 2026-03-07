-- ============================================================================
-- Migration: 00012_cron
-- Description: pg_cron + pg_net extensions, invoke_edge_function helper,
--              and scheduled jobs for recurring operations
-- ============================================================================

-- ==========================================================================
-- 1. Extensions
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- ==========================================================================
-- 2. Helper function: invoke_edge_function
-- ==========================================================================

-- Requires vault secrets to be configured:
--   SELECT vault.create_secret('<project-url>', 'project_url');
--   SELECT vault.create_secret('<service-role-key>', 'service_role_key');

CREATE OR REPLACE FUNCTION invoke_edge_function(
  p_function_name text,
  p_body          jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_url text;
  v_service_key text;
  v_request_id  bigint;
BEGIN
  SELECT decrypted_secret INTO v_project_url
  FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  SELECT net.http_post(
    url     := v_project_url || '/functions/v1/' || p_function_name,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := p_body
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- ==========================================================================
-- 3. Scheduled jobs
-- ==========================================================================

-- 3a. Generate recurring bookings — daily at 01:00 UTC
SELECT cron.schedule(
  'generate-recurring-bookings',
  '0 1 * * *',
  $$ SELECT invoke_edge_function('generate-recurring-bookings'); $$
);

-- 3b. Booking reminders — every hour at :00
SELECT cron.schedule(
  'send-booking-reminders',
  '0 * * * *',
  $$ SELECT invoke_edge_function('send-booking-reminders'); $$
);

-- 3c. Trial follow-ups — daily at 09:00 UTC
SELECT cron.schedule(
  'send-trial-follow-ups',
  '0 9 * * *',
  $$ SELECT invoke_edge_function('send-trial-follow-ups'); $$
);

-- 3d. Monthly stats generation — 1st of month at 02:00 UTC
SELECT cron.schedule(
  'generate-monthly-stats',
  '0 2 1 * *',
  $$ SELECT invoke_edge_function('generate-monthly-stats'); $$
);

-- 3e. Daily stats generation — daily at 03:00 UTC
SELECT cron.schedule(
  'generate-daily-stats',
  '0 3 * * *',
  $$ SELECT invoke_edge_function('generate-daily-stats'); $$
);

-- 3f. Credit expiry — daily at midnight UTC
SELECT cron.schedule(
  'expire-renewable-credits',
  '0 0 * * *',
  $$ SELECT invoke_edge_function('expire-renewable-credits'); $$
);

-- ==========================================================================
-- 4. Rollback
-- ==========================================================================
-- SELECT cron.unschedule('expire-renewable-credits');
-- SELECT cron.unschedule('generate-daily-stats');
-- SELECT cron.unschedule('generate-monthly-stats');
-- SELECT cron.unschedule('send-trial-follow-ups');
-- SELECT cron.unschedule('send-booking-reminders');
-- SELECT cron.unschedule('generate-recurring-bookings');
-- DROP FUNCTION IF EXISTS invoke_edge_function(text, jsonb);
-- DROP EXTENSION IF EXISTS pg_net;
-- DROP EXTENSION IF EXISTS pg_cron;
