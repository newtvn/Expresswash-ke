-- Schedule notification_outbox processing through the service-role worker.
-- Requires pg_cron, pg_net, and vault secrets:
--   supabase_url
--   service_role_key

SELECT cron.unschedule('process-notification-outbox')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-notification-outbox');

SELECT cron.schedule(
  'process-notification-outbox',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
           || '/functions/v1/notification-worker',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' ||
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'apikey',
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('limit', 25)
  );
  $$
);
