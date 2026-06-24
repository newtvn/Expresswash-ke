-- ============================================================
-- Accounting payment safety fixes
--
-- 1. Record admin invoice payments atomically.
-- 2. Keep invoice paid_amount/balance consistent when M-Pesa
--    order payment callbacks mark linked invoices as paid.
-- ============================================================

CREATE OR REPLACE FUNCTION record_invoice_payment(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_method payment_method DEFAULT 'mpesa',
  p_reference TEXT DEFAULT NULL,
  p_recorded_by TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_current_paid NUMERIC(12,2);
  v_current_balance NUMERIC(12,2);
  v_new_paid NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_new_status invoice_status;
  v_payment_id UUID;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can record invoice payments';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  SELECT *
  INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;

  IF v_invoice.status::TEXT = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot record payment for a cancelled invoice';
  END IF;

  v_current_paid := ROUND(COALESCE(v_invoice.paid_amount, 0), 2);
  v_current_balance := ROUND(COALESCE(NULLIF(v_invoice.balance, 0), GREATEST(COALESCE(v_invoice.total, 0) - v_current_paid, 0)), 2);

  IF v_current_balance <= 0 THEN
    RAISE EXCEPTION 'Invoice is already fully paid';
  END IF;

  IF ROUND(p_amount, 2) > v_current_balance THEN
    RAISE EXCEPTION 'Payment amount % exceeds invoice balance %', p_amount, v_current_balance;
  END IF;

  v_new_paid := ROUND(v_current_paid + p_amount, 2);
  v_new_balance := ROUND(GREATEST(COALESCE(v_invoice.total, 0) - v_new_paid, 0), 2);
  v_new_status := CASE
    WHEN v_new_balance <= 0 THEN 'paid'::invoice_status
    WHEN v_new_paid > 0 THEN 'partial'::invoice_status
    ELSE 'pending'::invoice_status
  END;

  INSERT INTO payments (
    invoice_id,
    invoice_number,
    customer_id,
    customer_name,
    amount,
    method,
    status,
    reference,
    recorded_by,
    notes,
    completed_at,
    updated_at
  ) VALUES (
    v_invoice.id,
    v_invoice.invoice_number,
    v_invoice.customer_id,
    v_invoice.customer_name,
    ROUND(p_amount, 2),
    p_method,
    'completed'::payment_status,
    p_reference,
    p_recorded_by,
    p_notes,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_payment_id;

  UPDATE invoices
  SET
    paid_amount = v_new_paid,
    balance = v_new_balance,
    status = v_new_status,
    paid_at = CASE WHEN v_new_status = 'paid'::invoice_status THEN NOW() ELSE paid_at END,
    updated_at = NOW()
  WHERE id = v_invoice.id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'invoice_id', v_invoice.id,
    'paid_amount', v_new_paid,
    'balance', v_new_balance,
    'status', v_new_status::TEXT
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION record_invoice_payment(UUID, NUMERIC, payment_method, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION complete_payment_transaction(
  p_payment_id UUID,
  p_order_id UUID,
  p_transaction_id TEXT,
  p_result_code INTEGER,
  p_result_desc TEXT
) RETURNS JSONB AS $$
DECLARE
  v_payment_status TEXT;
BEGIN
  v_payment_status := CASE
    WHEN p_result_code = 0 THEN 'completed'
    WHEN p_result_code = 3 THEN 'cancelled'
    ELSE 'failed'
  END;

  UPDATE payments
  SET
    status = v_payment_status::payment_status,
    transaction_id = p_transaction_id,
    result_code = p_result_code,
    result_desc = p_result_desc,
    completed_at = CASE WHEN p_result_code = 0 THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_payment_id;

  IF v_payment_status = 'completed' AND p_order_id IS NOT NULL THEN
    UPDATE orders
    SET payment_status = 'paid', updated_at = NOW()
    WHERE id = p_order_id;

    UPDATE invoices
    SET
      status = 'paid',
      paid_at = COALESCE(paid_at, NOW()),
      paid_amount = total,
      balance = 0,
      updated_at = NOW()
    WHERE order_id = p_order_id
      AND status != 'paid';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_status', v_payment_status,
    'order_updated', v_payment_status = 'completed'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
