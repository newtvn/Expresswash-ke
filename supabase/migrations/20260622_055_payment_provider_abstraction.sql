-- ============================================================
-- Payment provider abstraction
--
-- Keeps the existing checkout_request_id compatibility path while
-- adding explicit provider fields for PesaPal and future providers.
-- ============================================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS provider_status TEXT,
  ADD COLUMN IF NOT EXISTS provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE payments
SET provider = CASE
  WHEN checkout_request_id IS NOT NULL THEN 'legacy_mpesa'
  WHEN invoice_id IS NOT NULL THEN 'manual'
  ELSE provider
END
WHERE provider = 'manual';

CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id
  ON payments(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_provider_reference
  ON payments(provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_provider_slug;

ALTER TABLE payments
  ADD CONSTRAINT payments_provider_slug
  CHECK (provider ~ '^[a-z0-9_-]+$');

CREATE OR REPLACE FUNCTION process_payment_callback(
  p_checkout_request_id TEXT,
  p_merchant_request_id TEXT,
  p_result_code INTEGER,
  p_result_desc TEXT,
  p_amount NUMERIC,
  p_mpesa_receipt_number TEXT
) RETURNS JSONB AS $$
DECLARE
  v_payment RECORD;
  v_result JSONB;
  v_provider_status TEXT;
  v_target_status TEXT;
BEGIN
  v_provider_status := CASE
    WHEN p_result_code = 0 THEN 'completed'
    WHEN p_result_code = 3 THEN 'reversed'
    ELSE 'failed'
  END;

  v_target_status := CASE
    WHEN p_result_code = 0 THEN 'completed'
    WHEN p_result_code = 3 THEN 'cancelled'
    ELSE 'failed'
  END;

  SELECT * INTO v_payment
  FROM payments
  WHERE checkout_request_id = p_checkout_request_id
     OR provider_payment_id = p_checkout_request_id
     OR (p_merchant_request_id IS NOT NULL AND provider_reference = p_merchant_request_id)
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment not found',
      'checkout_request_id', p_checkout_request_id,
      'merchant_request_id', p_merchant_request_id
    );
  END IF;

  IF v_payment.status::TEXT = v_target_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Payment already processed (idempotent)',
      'status', v_payment.status,
      'idempotent', true
    );
  END IF;

  IF p_amount IS NOT NULL AND ABS(v_payment.amount - p_amount) > 0.01 THEN
    UPDATE payments
    SET
      status = 'failed'::payment_status,
      provider_status = 'amount_mismatch',
      failure_reason = 'Amount mismatch',
      result_code = p_result_code,
      result_desc = p_result_desc,
      provider_metadata = COALESCE(provider_metadata, '{}'::jsonb) || jsonb_build_object(
        'lastCallback', jsonb_build_object(
          'checkoutRequestId', p_checkout_request_id,
          'merchantRequestId', p_merchant_request_id,
          'resultCode', p_result_code,
          'resultDesc', p_result_desc,
          'amount', p_amount,
          'receivedAt', NOW()
        )
      ),
      updated_at = NOW()
    WHERE id = v_payment.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount mismatch',
      'expected', v_payment.amount,
      'received', p_amount
    );
  END IF;

  UPDATE payments
  SET
    provider_payment_id = COALESCE(provider_payment_id, p_checkout_request_id),
    provider_reference = COALESCE(provider_reference, p_merchant_request_id),
    provider_status = v_provider_status,
    mpesa_receipt_number = COALESCE(p_mpesa_receipt_number, mpesa_receipt_number),
    provider_metadata = COALESCE(provider_metadata, '{}'::jsonb) || jsonb_build_object(
      'lastCallback', jsonb_build_object(
        'checkoutRequestId', p_checkout_request_id,
        'merchantRequestId', p_merchant_request_id,
        'resultCode', p_result_code,
        'resultDesc', p_result_desc,
        'amount', p_amount,
        'receiptNumber', p_mpesa_receipt_number,
        'providerStatus', v_provider_status,
        'receivedAt', NOW()
      )
    ),
    updated_at = NOW()
  WHERE id = v_payment.id;

  SELECT * INTO v_result
  FROM complete_payment_transaction(
    v_payment.id,
    v_payment.order_id,
    p_mpesa_receipt_number,
    p_result_code,
    p_result_desc
  );

  v_result := v_result || jsonb_build_object('idempotent', false);
  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
