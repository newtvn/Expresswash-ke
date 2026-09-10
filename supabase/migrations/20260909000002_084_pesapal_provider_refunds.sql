-- Provider-backed refunds are reserved before the external PesaPal call and
-- remain separate from customer_refunds until settlement is confirmed.

CREATE TABLE IF NOT EXISTS provider_refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  business TEXT NOT NULL,
  provider TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'KES',
  reason TEXT NOT NULL CHECK (LENGTH(TRIM(reason)) > 0),
  idempotency_key TEXT NOT NULL CHECK (LENGTH(TRIM(idempotency_key)) >= 8),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitting', 'requested', 'processing', 'completed',
    'rejected', 'failed_retryable'
  )),
  provider_confirmation_code TEXT,
  provider_payment_method TEXT,
  provider_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  customer_refund_id UUID REFERENCES customer_refunds(id) ON DELETE RESTRICT,
  posted_journal_entry_id UUID REFERENCES ledger_journal_entries(id) ON DELETE RESTRICT,
  completion_evidence_reference TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT provider_refund_one_request_per_payment UNIQUE (payment_id),
  CONSTRAINT provider_refund_idempotency UNIQUE (business, idempotency_key),
  CONSTRAINT provider_refund_completion_links CHECK (
    status <> 'completed' OR (
      customer_refund_id IS NOT NULL
      AND posted_journal_entry_id IS NOT NULL
      AND completion_evidence_reference IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_provider_refund_requests_business_created
  ON provider_refund_requests(business, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_refund_requests_status
  ON provider_refund_requests(status, updated_at);

ALTER TABLE provider_refund_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provider_refund_requests_admin_read" ON provider_refund_requests;
CREATE POLICY "provider_refund_requests_admin_read" ON provider_refund_requests
  FOR SELECT TO authenticated
  USING (accounting_can_see_business(business));

-- Reserve exactly one provider request while holding the payment row lock.
CREATE OR REPLACE FUNCTION prepare_provider_refund_request(
  p_payment_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_idempotency_key TEXT
) RETURNS JSONB AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_request provider_refund_requests%ROWTYPE;
  v_currency TEXT;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can request provider refunds' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_payment_id IS NULL THEN RAISE EXCEPTION 'Payment is required'; END IF;
  IF p_amount IS NULL OR ROUND(p_amount, 2) <= 0 THEN RAISE EXCEPTION 'Refund amount must be greater than zero'; END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN RAISE EXCEPTION 'A refund reason is required'; END IF;
  IF LENGTH(COALESCE(TRIM(p_idempotency_key), '')) < 8 THEN RAISE EXCEPTION 'A valid idempotency key is required'; END IF;

  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF NOT accounting_can_see_business(v_payment.business) THEN
    RAISE EXCEPTION 'Payment not found or not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_payment.provider <> 'pesapal' THEN RAISE EXCEPTION 'Payment is not a PesaPal payment'; END IF;
  IF v_payment.status::TEXT <> 'completed' THEN RAISE EXCEPTION 'Only completed payments can be refunded'; END IF;
  IF ROUND(p_amount, 2) > ROUND(v_payment.amount, 2) THEN RAISE EXCEPTION 'Refund amount exceeds original payment'; END IF;
  IF COALESCE(v_payment.provider_payment_id, v_payment.checkout_request_id) IS NULL THEN
    RAISE EXCEPTION 'Payment is missing its provider tracking ID';
  END IF;

  SELECT * INTO v_request
  FROM provider_refund_requests
  WHERE payment_id = p_payment_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_request.idempotency_key <> TRIM(p_idempotency_key) THEN
      RAISE EXCEPTION 'Only one provider refund request is allowed per payment';
    END IF;
    IF v_request.amount <> ROUND(p_amount, 2) OR v_request.reason <> TRIM(p_reason) THEN
      RAISE EXCEPTION 'Idempotency key was already used with different refund details';
    END IF;
    IF v_request.status = 'failed_retryable' THEN
      UPDATE provider_refund_requests
      SET status = 'submitting', attempt_count = attempt_count + 1,
          provider_message = NULL, updated_at = NOW()
      WHERE id = v_request.id
      RETURNING * INTO v_request;
      RETURN jsonb_build_object('success', true, 'request_id', v_request.id, 'status', v_request.status, 'idempotent', false);
    END IF;
    RETURN jsonb_build_object('success', true, 'request_id', v_request.id, 'status', v_request.status, 'idempotent', true);
  END IF;

  v_currency := UPPER(COALESCE(NULLIF(v_payment.provider_metadata->>'currency', ''), 'KES'));
  INSERT INTO provider_refund_requests (
    payment_id, invoice_id, business, provider, amount, currency, reason,
    idempotency_key, status, attempt_count, created_by
  ) VALUES (
    v_payment.id, v_payment.invoice_id, v_payment.business, v_payment.provider,
    ROUND(p_amount, 2), v_currency, TRIM(p_reason), TRIM(p_idempotency_key),
    'submitting', 1, auth.uid()
  ) RETURNING * INTO v_request;

  RETURN jsonb_build_object('success', true, 'request_id', v_request.id, 'status', v_request.status, 'idempotent', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION prepare_provider_refund_request(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION prepare_provider_refund_request(UUID, NUMERIC, TEXT, TEXT) TO authenticated, service_role;

-- Called by the authenticated refund Edge Function after validating the provider response.
CREATE OR REPLACE FUNCTION mark_provider_refund_submission(
  p_request_id UUID,
  p_status TEXT,
  p_provider_message TEXT,
  p_confirmation_code TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only the refund service can update provider submission state' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_status NOT IN ('requested', 'processing', 'rejected', 'failed_retryable') THEN
    RAISE EXCEPTION 'Invalid provider refund status';
  END IF;

  SELECT status INTO v_current_status
  FROM provider_refund_requests
  WHERE id = p_request_id
    AND accounting_can_see_business(business)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider refund request not found';
  END IF;
  IF v_current_status <> 'submitting' THEN
    RAISE EXCEPTION 'Provider refund request cannot transition from %', v_current_status;
  END IF;

  UPDATE provider_refund_requests
  SET status = p_status,
      provider_message = NULLIF(LEFT(COALESCE(p_provider_message, ''), 500), ''),
      provider_confirmation_code = COALESCE(NULLIF(p_confirmation_code, ''), provider_confirmation_code),
      provider_payment_method = COALESCE(NULLIF(p_payment_method, ''), provider_payment_method),
      submitted_at = CASE WHEN p_status IN ('requested', 'processing') THEN COALESCE(submitted_at, NOW()) ELSE submitted_at END,
      updated_at = NOW()
  WHERE id = p_request_id
    AND accounting_can_see_business(business);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION mark_provider_refund_submission(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_provider_refund_submission(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Settlement is a separate authorized step. Only this transition creates the
-- accounting refund and cash-out journal.
CREATE OR REPLACE FUNCTION complete_provider_refund_request(
  p_request_id UUID,
  p_evidence_reference TEXT
) RETURNS JSONB AS $$
DECLARE
  v_request provider_refund_requests%ROWTYPE;
  v_payment payments%ROWTYPE;
  v_result JSONB;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can complete provider refunds' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF COALESCE(TRIM(p_evidence_reference), '') = '' THEN
    RAISE EXCEPTION 'Completion evidence reference is required';
  END IF;

  SELECT * INTO v_request FROM provider_refund_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR NOT accounting_can_see_business(v_request.business) THEN
    RAISE EXCEPTION 'Provider refund request not found or not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_request.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'refund_id', v_request.customer_refund_id,
      'journal_entry_id', v_request.posted_journal_entry_id, 'status', v_request.status
    );
  END IF;
  IF v_request.status NOT IN ('requested', 'processing') THEN
    RAISE EXCEPTION 'Only a requested or processing refund can be confirmed completed';
  END IF;

  SELECT * INTO v_payment FROM payments WHERE id = v_request.payment_id FOR UPDATE;
  v_result := record_customer_refund(
    v_request.invoice_id,
    v_request.payment_id,
    v_request.amount,
    v_payment.method,
    COALESCE(v_request.provider_confirmation_code, v_payment.mpesa_receipt_number),
    'PesaPal refund completed: ' || v_request.reason
  );
  IF COALESCE((v_result->>'success')::BOOLEAN, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Accounting refund failed: %', COALESCE(v_result->>'error', 'unknown error');
  END IF;

  UPDATE provider_refund_requests
  SET status = 'completed', customer_refund_id = (v_result->>'refund_id')::UUID,
      posted_journal_entry_id = (v_result->>'journal_entry_id')::UUID,
      completion_evidence_reference = TRIM(p_evidence_reference),
      completed_at = NOW(), updated_at = NOW()
  WHERE id = v_request.id;

  RETURN v_result || jsonb_build_object('status', 'completed', 'idempotent', false, 'provider_refund_request_id', v_request.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION complete_provider_refund_request(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION complete_provider_refund_request(UUID, TEXT) TO authenticated, service_role;

GRANT SELECT ON provider_refund_requests TO authenticated;
GRANT ALL ON provider_refund_requests TO service_role;
