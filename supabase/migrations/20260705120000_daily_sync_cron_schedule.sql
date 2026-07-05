-- Migration: Schedule daily-sync-cron via pg_cron
-- Runs at 4:00 AM UTC every day

-- Enable pg_cron extension if not already present
-- (Already enabled in most Supabase projects, but this ensures it)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any existing schedule with this name before re-adding it
SELECT cron.unschedule('atlas-daily-sync-cron')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'atlas-daily-sync-cron'
);

-- Schedule the edge function to run at 04:00 UTC daily
SELECT cron.schedule(
  'atlas-daily-sync-cron',
  '0 4 * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/daily-sync-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    )
  $$
);
