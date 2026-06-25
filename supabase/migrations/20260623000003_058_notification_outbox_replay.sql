-- ============================================================
-- Notification outbox and replay foundation
--
-- This prepares WhatsApp/email/SMS delivery without sending inside
-- finance request handlers. Events are written first, workers send
-- later, and failed deliveries can be replayed.
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'push', 'webhook')),
  recipient_contact TEXT NOT NULL,
  recipient_name TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'dead_letter', 'cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  last_error TEXT,
  provider TEXT,
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
  ON notification_outbox(status, available_at, created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_notification_outbox_aggregate
  ON notification_outbox(aggregate_type, aggregate_id);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_channel
  ON notification_outbox(channel, status);

ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_outbox_admin_all" ON notification_outbox;
CREATE POLICY "notification_outbox_admin_all" ON notification_outbox
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

DROP TRIGGER IF EXISTS trg_notification_outbox_updated_at ON notification_outbox;
CREATE TRIGGER trg_notification_outbox_updated_at
  BEFORE UPDATE ON notification_outbox
  FOR EACH ROW
  EXECUTE FUNCTION accounting_touch_updated_at();

CREATE TABLE IF NOT EXISTS notification_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id UUID NOT NULL REFERENCES notification_outbox(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  provider TEXT,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_status INTEGER,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  error_message TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_attempts_outbox
  ON notification_delivery_attempts(outbox_id, attempted_at DESC);

ALTER TABLE notification_delivery_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_delivery_attempts_admin_all" ON notification_delivery_attempts;
CREATE POLICY "notification_delivery_attempts_admin_all" ON notification_delivery_attempts
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

CREATE OR REPLACE FUNCTION enqueue_notification_outbox(
  p_event_type TEXT,
  p_aggregate_type TEXT,
  p_aggregate_id UUID,
  p_channel TEXT,
  p_recipient_contact TEXT,
  p_recipient_name TEXT,
  p_payload JSONB,
  p_idempotency_key TEXT,
  p_available_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins or service role can enqueue notifications';
  END IF;

  INSERT INTO notification_outbox (
    event_type,
    aggregate_type,
    aggregate_id,
    channel,
    recipient_contact,
    recipient_name,
    payload,
    idempotency_key,
    available_at,
    created_by
  )
  VALUES (
    p_event_type,
    p_aggregate_type,
    p_aggregate_id,
    p_channel,
    p_recipient_contact,
    p_recipient_name,
    COALESCE(p_payload, '{}'::jsonb),
    p_idempotency_key,
    COALESCE(p_available_at, NOW()),
    auth.uid()
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET
    payload = EXCLUDED.payload,
    recipient_contact = EXCLUDED.recipient_contact,
    recipient_name = EXCLUDED.recipient_name,
    available_at = LEAST(notification_outbox.available_at, EXCLUDED.available_at),
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION mark_notification_attempt(
  p_outbox_id UUID,
  p_provider TEXT,
  p_request_payload JSONB,
  p_response_payload JSONB,
  p_response_status INTEGER,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_attempt INTEGER;
  v_next_status TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins or service role can mark notification attempts';
  END IF;

  SELECT attempt_count + 1 INTO v_attempt
  FROM notification_outbox
  WHERE id = p_outbox_id
  FOR UPDATE;

  IF v_attempt IS NULL THEN
    RAISE EXCEPTION 'Outbox item not found';
  END IF;

  INSERT INTO notification_delivery_attempts (
    outbox_id,
    attempt_number,
    provider,
    request_payload,
    response_payload,
    response_status,
    success,
    error_message
  )
  VALUES (
    p_outbox_id,
    v_attempt,
    p_provider,
    COALESCE(p_request_payload, '{}'::jsonb),
    COALESCE(p_response_payload, '{}'::jsonb),
    p_response_status,
    COALESCE(p_success, FALSE),
    p_error_message
  );

  SELECT CASE
    WHEN COALESCE(p_success, FALSE) THEN 'delivered'
    WHEN v_attempt >= max_attempts THEN 'dead_letter'
    ELSE 'failed'
  END
  INTO v_next_status
  FROM notification_outbox
  WHERE id = p_outbox_id;

  UPDATE notification_outbox
  SET
    status = v_next_status,
    attempt_count = v_attempt,
    provider = COALESCE(p_provider, provider),
    provider_message_id = COALESCE(p_response_payload->>'provider_message_id', provider_message_id),
    sent_at = CASE WHEN COALESCE(p_success, FALSE) THEN COALESCE(sent_at, NOW()) ELSE sent_at END,
    delivered_at = CASE WHEN COALESCE(p_success, FALSE) THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END,
    last_error = CASE WHEN COALESCE(p_success, FALSE) THEN NULL ELSE p_error_message END,
    available_at = CASE
      WHEN COALESCE(p_success, FALSE) OR v_next_status = 'dead_letter' THEN available_at
      ELSE NOW() + (POWER(2, LEAST(v_attempt, 6))::TEXT || ' minutes')::INTERVAL
    END,
    updated_at = NOW()
  WHERE id = p_outbox_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION replay_notification_outbox(
  p_outbox_id UUID
) RETURNS UUID AS $$
DECLARE
  v_new_id UUID;
  v_old notification_outbox%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins or service role can replay notifications';
  END IF;

  SELECT * INTO v_old
  FROM notification_outbox
  WHERE id = p_outbox_id;

  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Outbox item not found';
  END IF;

  INSERT INTO notification_outbox (
    event_type,
    aggregate_type,
    aggregate_id,
    channel,
    recipient_contact,
    recipient_name,
    payload,
    idempotency_key,
    provider,
    created_by
  )
  VALUES (
    v_old.event_type,
    v_old.aggregate_type,
    v_old.aggregate_id,
    v_old.channel,
    v_old.recipient_contact,
    v_old.recipient_name,
    v_old.payload || jsonb_build_object('replayed_from', v_old.id),
    v_old.idempotency_key || ':replay:' || REPLACE(gen_random_uuid()::TEXT, '-', ''),
    v_old.provider,
    auth.uid()
  )
  RETURNING id INTO v_new_id;

  UPDATE notification_outbox
  SET status = CASE WHEN status = 'dead_letter' THEN 'failed' ELSE status END,
      updated_at = NOW()
  WHERE id = p_outbox_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION enqueue_notification_outbox(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_attempt(UUID, TEXT, JSONB, JSONB, INTEGER, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION replay_notification_outbox(UUID) TO authenticated;
