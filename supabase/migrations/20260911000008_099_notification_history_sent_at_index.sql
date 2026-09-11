-- Keep notification history pagination ordered efficiently as the table grows.
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at
  ON public.notification_history(sent_at DESC);
