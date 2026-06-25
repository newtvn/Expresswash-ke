-- Store provider-observed payer phone separately from the phone entered in our UI.
-- A mismatch is audit metadata, not a payment failure, because third parties can pay an order.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payer_phone_number TEXT,
  ADD COLUMN IF NOT EXISTS payer_phone_matches_intent BOOLEAN,
  ADD COLUMN IF NOT EXISTS payer_phone_mismatch_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION normalize_kenyan_payment_phone(p_phone TEXT)
RETURNS TEXT AS $$
DECLARE
  v_phone TEXT;
BEGIN
  IF p_phone IS NULL OR btrim(p_phone) = '' THEN
    RETURN NULL;
  END IF;

  v_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');

  IF v_phone ~ '^0[17][0-9]{8}$' THEN
    RETURN '254' || substring(v_phone FROM 2);
  END IF;

  IF v_phone ~ '^[17][0-9]{8}$' THEN
    RETURN '254' || v_phone;
  END IF;

  IF v_phone ~ '^254[17][0-9]{8}$' THEN
    RETURN v_phone;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DROP FUNCTION IF EXISTS process_payment_callback(TEXT, TEXT, INTEGER, TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION process_payment_callback(
  p_checkout_request_id TEXT,
  p_merchant_request_id TEXT,
  p_result_code INTEGER,
  p_result_desc TEXT,
  p_amount NUMERIC,
  p_mpesa_receipt_number TEXT,
  p_provider_payload JSONB DEFAULT '{}'::jsonb,
  p_payer_phone_number TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_payment RECORD;
  v_result JSONB;
  v_provider_status TEXT;
  v_target_status TEXT;
  v_intent_phone TEXT;
  v_payer_phone TEXT;
  v_phone_matches BOOLEAN;
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

  v_intent_phone := normalize_kenyan_payment_phone(v_payment.phone_number);
  v_payer_phone := normalize_kenyan_payment_phone(COALESCE(
    p_payer_phone_number,
    p_provider_payload #>> '{transactionStatus,phone_number}',
    p_provider_payload #>> '{transactionStatus,payer_phone_number}',
    p_provider_payload #>> '{transactionStatus,customer_phone_number}',
    p_provider_payload #>> '{transactionStatus,msisdn}',
    p_provider_payload #>> '{phone_number}',
    p_provider_payload #>> '{payer_phone_number}',
    p_provider_payload #>> '{customer_phone_number}',
    p_provider_payload #>> '{msisdn}'
  ));

  v_phone_matches := CASE
    WHEN v_intent_phone IS NULL OR v_payer_phone IS NULL THEN NULL
    ELSE v_intent_phone = v_payer_phone
  END;

  IF v_payment.status::TEXT = v_target_status THEN
    UPDATE payments
    SET
      payer_phone_number = COALESCE(v_payer_phone, payer_phone_number),
      payer_phone_matches_intent = COALESCE(v_phone_matches, payer_phone_matches_intent),
      payer_phone_mismatch_at = CASE
        WHEN v_phone_matches IS FALSE THEN COALESCE(payer_phone_mismatch_at, NOW())
        ELSE payer_phone_mismatch_at
      END,
      provider_metadata = COALESCE(provider_metadata, '{}'::jsonb) || jsonb_build_object(
        'lastCallback', jsonb_build_object(
          'checkoutRequestId', p_checkout_request_id,
          'merchantRequestId', p_merchant_request_id,
          'resultCode', p_result_code,
          'resultDesc', p_result_desc,
          'amount', p_amount,
          'receiptNumber', p_mpesa_receipt_number,
          'providerStatus', v_provider_status,
          'payerPhoneNumber', v_payer_phone,
          'payerPhoneMatchesIntent', v_phone_matches,
          'providerPayload', COALESCE(p_provider_payload, '{}'::jsonb),
          'receivedAt', NOW()
        )
      ),
      updated_at = NOW()
    WHERE id = v_payment.id;

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
      payer_phone_number = COALESCE(v_payer_phone, payer_phone_number),
      payer_phone_matches_intent = COALESCE(v_phone_matches, payer_phone_matches_intent),
      payer_phone_mismatch_at = CASE
        WHEN v_phone_matches IS FALSE THEN COALESCE(payer_phone_mismatch_at, NOW())
        ELSE payer_phone_mismatch_at
      END,
      provider_metadata = COALESCE(provider_metadata, '{}'::jsonb) || jsonb_build_object(
        'lastCallback', jsonb_build_object(
          'checkoutRequestId', p_checkout_request_id,
          'merchantRequestId', p_merchant_request_id,
          'resultCode', p_result_code,
          'resultDesc', p_result_desc,
          'amount', p_amount,
          'receivedAt', NOW(),
          'payerPhoneNumber', v_payer_phone,
          'payerPhoneMatchesIntent', v_phone_matches,
          'providerPayload', COALESCE(p_provider_payload, '{}'::jsonb)
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
    payer_phone_number = COALESCE(v_payer_phone, payer_phone_number),
    payer_phone_matches_intent = COALESCE(v_phone_matches, payer_phone_matches_intent),
    payer_phone_mismatch_at = CASE
      WHEN v_phone_matches IS FALSE THEN COALESCE(payer_phone_mismatch_at, NOW())
      ELSE payer_phone_mismatch_at
    END,
    provider_metadata = COALESCE(provider_metadata, '{}'::jsonb) || jsonb_build_object(
      'lastCallback', jsonb_build_object(
        'checkoutRequestId', p_checkout_request_id,
        'merchantRequestId', p_merchant_request_id,
        'resultCode', p_result_code,
        'resultDesc', p_result_desc,
        'amount', p_amount,
        'receiptNumber', p_mpesa_receipt_number,
        'providerStatus', v_provider_status,
        'payerPhoneNumber', v_payer_phone,
        'payerPhoneMatchesIntent', v_phone_matches,
        'providerPayload', COALESCE(p_provider_payload, '{}'::jsonb),
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

  v_result := v_result || jsonb_build_object(
    'idempotent', false,
    'payer_phone_matches_intent', v_phone_matches
  );
  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION process_payment_callback(TEXT, TEXT, INTEGER, TEXT, NUMERIC, TEXT, JSONB, TEXT) TO service_role;
