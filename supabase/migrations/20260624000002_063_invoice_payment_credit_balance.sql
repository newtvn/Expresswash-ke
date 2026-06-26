-- ============================================================
-- Keep invoice payment balances credit-note aware
--
-- Credit notes reduce invoice balance but are not cash received.
-- Manual payments must subtract from the current open balance rather
-- than recomputing balance as total - paid_amount, otherwise any
-- previously-applied credit note is lost on the next payment.
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
  v_payment_post JSONB;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can record invoice payments';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  SELECT * INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_invoice.status::TEXT = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot record payment for a cancelled invoice';
  END IF;

  v_current_paid := ROUND(COALESCE(v_invoice.paid_amount, 0), 2);
  v_current_balance := ROUND(
    COALESCE(
      v_invoice.balance,
      GREATEST(COALESCE(v_invoice.total, 0) - v_current_paid, 0)
    ),
    2
  );

  IF v_current_balance <= 0 THEN
    RAISE EXCEPTION 'Invoice is already fully paid';
  END IF;

  IF ROUND(p_amount, 2) > v_current_balance THEN
    RAISE EXCEPTION 'Payment amount % exceeds invoice balance %', p_amount, v_current_balance;
  END IF;

  v_new_paid := ROUND(v_current_paid + p_amount, 2);
  v_new_balance := ROUND(GREATEST(v_current_balance - p_amount, 0), 2);
  v_new_status := CASE
    WHEN v_new_balance <= 0 THEN 'paid'::invoice_status
    WHEN v_new_paid > 0 THEN 'partial'::invoice_status
    ELSE 'pending'::invoice_status
  END;

  IF v_invoice.posted_journal_entry_id IS NULL THEN
    PERFORM post_invoice_to_ledger(v_invoice.id);
  END IF;

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

  INSERT INTO payment_allocations (payment_id, invoice_id, amount_allocated, created_by)
  VALUES (v_payment_id, v_invoice.id, ROUND(p_amount, 2), auth.uid())
  ON CONFLICT (payment_id, invoice_id)
  DO UPDATE SET amount_allocated = EXCLUDED.amount_allocated,
                allocated_at = NOW();

  UPDATE invoices
  SET paid_amount = v_new_paid,
      balance = v_new_balance,
      status = v_new_status,
      paid_at = CASE WHEN v_new_status = 'paid'::invoice_status THEN NOW() ELSE paid_at END,
      updated_at = NOW()
  WHERE id = v_invoice.id;

  v_payment_post := post_payment_received_to_ledger(v_payment_id);

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'invoice_id', v_invoice.id,
    'paid_amount', v_new_paid,
    'balance', v_new_balance,
    'status', v_new_status::TEXT,
    'journal_entry_id', v_payment_post->>'journal_entry_id'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

WITH applied_credits AS (
  SELECT invoice_id, ROUND(SUM(COALESCE(applied_amount, total, 0)), 2) AS credit_total
  FROM credit_notes
  WHERE status::TEXT IN ('applied', 'open')
  GROUP BY invoice_id
)
UPDATE invoices i
SET balance = ROUND(GREATEST(COALESCE(i.total, 0) - COALESCE(i.paid_amount, 0) - COALESCE(ac.credit_total, 0), 0), 2),
    status = CASE
      WHEN ROUND(GREATEST(COALESCE(i.total, 0) - COALESCE(i.paid_amount, 0) - COALESCE(ac.credit_total, 0), 0), 2) <= 0 THEN 'paid'::invoice_status
      WHEN COALESCE(i.paid_amount, 0) > 0 OR COALESCE(ac.credit_total, 0) > 0 THEN 'partial'::invoice_status
      ELSE i.status
    END,
    updated_at = NOW()
FROM applied_credits ac
WHERE ac.invoice_id = i.id
  AND i.status::TEXT <> 'cancelled';

GRANT EXECUTE ON FUNCTION record_invoice_payment(UUID, NUMERIC, payment_method, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_invoice_payment(UUID, NUMERIC, payment_method, TEXT, TEXT, TEXT) TO service_role;
