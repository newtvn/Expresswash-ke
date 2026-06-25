-- ============================================================
-- Refund cumulative guard
--
-- Prevents repeated refund records from cumulatively exceeding
-- the original payment amount or invoice paid amount.
-- ============================================================

CREATE OR REPLACE FUNCTION record_customer_refund(
  p_invoice_id UUID,
  p_payment_id UUID,
  p_amount NUMERIC,
  p_method payment_method DEFAULT 'mpesa',
  p_reference TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_payment payments%ROWTYPE;
  v_contact_id UUID;
  v_refund_id UUID;
  v_refund_number TEXT;
  v_cash_account UUID;
  v_ar_account UUID := accounting_system_account_id('accounts_receivable');
  v_entry_id UUID;
  v_previous_refunds NUMERIC(12,2) := 0;
  v_refundable_amount NUMERIC(12,2);
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can record refunds';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be greater than zero';
  END IF;

  IF p_invoice_id IS NULL AND p_payment_id IS NULL THEN
    RAISE EXCEPTION 'Refund must reference an invoice or payment';
  END IF;

  IF p_invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
    IF v_invoice.id IS NULL THEN
      RAISE EXCEPTION 'Invoice not found';
    END IF;
  END IF;

  IF p_payment_id IS NOT NULL THEN
    SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
    IF v_payment.id IS NULL THEN
      RAISE EXCEPTION 'Payment not found';
    END IF;

    SELECT COALESCE(SUM(amount), 0)
    INTO v_previous_refunds
    FROM customer_refunds
    WHERE payment_id = p_payment_id
      AND status <> 'void';

    v_refundable_amount := ROUND(GREATEST(COALESCE(v_payment.amount, 0) - v_previous_refunds, 0), 2);
  ELSE
    SELECT COALESCE(SUM(amount), 0)
    INTO v_previous_refunds
    FROM customer_refunds
    WHERE invoice_id = p_invoice_id
      AND status <> 'void';

    v_refundable_amount := ROUND(GREATEST(COALESCE(v_invoice.paid_amount, 0) - v_previous_refunds, 0), 2);
  END IF;

  IF ROUND(p_amount, 2) > v_refundable_amount THEN
    RAISE EXCEPTION 'Refund amount exceeds remaining refundable amount of %', v_refundable_amount;
  END IF;

  v_contact_id := accounting_contact_for_profile(
    COALESCE(v_invoice.customer_id, v_payment.customer_id),
    COALESCE(v_invoice.customer_name, v_payment.customer_name),
    COALESCE(v_invoice.customer_phone, v_payment.phone_number),
    v_invoice.customer_email
  );

  v_refund_number := 'RF-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 6));
  v_cash_account := accounting_cash_account_id(p_method::TEXT);

  INSERT INTO customer_refunds (
    refund_number,
    contact_id,
    invoice_id,
    payment_id,
    amount,
    method,
    reference,
    reason,
    created_by
  ) VALUES (
    v_refund_number,
    v_contact_id,
    p_invoice_id,
    p_payment_id,
    ROUND(p_amount, 2),
    p_method,
    p_reference,
    p_reason,
    auth.uid()
  )
  RETURNING id INTO v_refund_id;

  v_entry_id := post_journal_entry(
    'manual_adjustment',
    v_refund_id,
    CURRENT_DATE,
    'Customer refund: ' || v_refund_number,
    jsonb_build_array(
      jsonb_build_object(
        'account_id', v_ar_account,
        'debit', ROUND(p_amount, 2),
        'contact_id', v_contact_id,
        'description', 'Restore receivable/customer credit for refund'
      ),
      jsonb_build_object(
        'account_id', v_cash_account,
        'credit', ROUND(p_amount, 2),
        'contact_id', v_contact_id,
        'description', 'Cash refunded to customer'
      )
    )
  );

  UPDATE customer_refunds
  SET posted_journal_entry_id = v_entry_id
  WHERE id = v_refund_id;

  RETURN jsonb_build_object('success', true, 'refund_id', v_refund_id, 'refund_number', v_refund_number, 'journal_entry_id', v_entry_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION record_customer_refund(UUID, UUID, NUMERIC, payment_method, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_customer_refund(UUID, UUID, NUMERIC, payment_method, TEXT, TEXT) TO service_role;
