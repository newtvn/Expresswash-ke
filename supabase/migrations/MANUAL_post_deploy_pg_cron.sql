-- ============================================================
-- POST-DEPLOY: pg_cron setup for automatic notification processing
--
-- PREREQUISITES (must be done in Supabase Dashboard first):
--   1. Go to Database → Extensions
--   2. Enable "pg_cron" extension
--   3. Enable "pg_net" extension
--
-- THEN replace the two placeholders below with your actual values:
--   YOUR_PROJECT_REF  → e.g. abcdefghijklmnop (from Project Settings → General)
--   YOUR_SERVICE_KEY   → from Project Settings → API → service_role key
--
-- Run in the Supabase SQL Editor.
-- This is NOT a regular migration — it requires the extensions
-- to be enabled via the dashboard before it can execute.
-- ============================================================

-- Schedule the send-notification Edge Function to run every minute.
-- pg_net.http_post sends an async HTTP request to the Edge Function.
SELECT cron.schedule(
  'process-notification-queue',   -- job name
  '* * * * *',                    -- every minute
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verify the job was created
SELECT jobid, schedule, command FROM cron.job WHERE jobname = 'process-notification-queue';

-- ============================================================
-- USEFUL COMMANDS
-- ============================================================
-- View job history:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--
-- Disable temporarily:
--   SELECT cron.unschedule('process-notification-queue');
--
-- Re-enable:
--   Run the SELECT cron.schedule(...) block above again.
-- ============================================================
