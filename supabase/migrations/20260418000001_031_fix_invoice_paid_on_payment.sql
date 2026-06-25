-- ============================================================
-- Fix: Update invoice status and paid_at when payment completes
-- Problem: complete_payment_transaction() updates orders.payment_status
--          but never touches invoices.paid_at or invoices.status
-- ============================================================

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
  IF p_result_code = 0 THEN
    v_payment_status := 'completed';
  ELSE
    v_payment_status := 'failed';
  END IF;

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

    -- Also mark corresponding invoices as paid
    UPDATE invoices
    SET status = 'paid', paid_at = NOW(), updated_at = NOW()
    WHERE order_id = p_order_id AND status != 'paid';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_status', v_payment_status,
    'order_updated', v_payment_status = 'completed'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
