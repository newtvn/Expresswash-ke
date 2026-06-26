-- Notification outbox worker claim RPC
-- Service-role workers claim due rows atomically, then record delivery
-- attempts through mark_notification_attempt(...).

CREATE OR REPLACE FUNCTION claim_notification_outbox_batch(
  p_limit INTEGER DEFAULT 25
) RETURNS SETOF notification_outbox AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only service role can claim notification outbox rows';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM notification_outbox
    WHERE attempt_count < max_attempts
      AND (
        (status IN ('pending', 'failed') AND available_at <= NOW())
        OR (status = 'processing' AND updated_at < NOW() - INTERVAL '15 minutes')
      )
    ORDER BY available_at ASC, created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 25), 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE notification_outbox n
  SET status = 'processing',
      updated_at = NOW()
  FROM candidates c
  WHERE n.id = c.id
  RETURNING n.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION claim_notification_outbox_batch(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_notification_outbox_batch(INTEGER) TO service_role;
