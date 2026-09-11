-- Cash refunds tied to invoices must reverse the sale and output VAT as well
-- as the cash receipt. Link an applied credit note to every such refund so the
-- document trail, P&L, VAT liability, A/R, and cash remain reconcilable.

ALTER TABLE public.customer_refunds
  ADD COLUMN IF NOT EXISTS credit_note_id UUID REFERENCES public.credit_notes(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_refunds_credit_note
  ON public.customer_refunds(credit_note_id)
  WHERE credit_note_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_customer_refund(
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
  v_business TEXT;
  v_credit_note_id UUID;
  v_credit_note_number TEXT;
  v_credit_subtotal NUMERIC(12,2);
  v_credit_tax NUMERIC(12,2);
  v_tax_rate NUMERIC(7,4);
  v_credit_post JSONB;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can record refunds' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_amount IS NULL OR ROUND(p_amount, 2) <= 0 THEN RAISE EXCEPTION 'Refund amount must be greater than zero'; END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN RAISE EXCEPTION 'A refund reason is required'; END IF;
  IF p_invoice_id IS NULL AND p_payment_id IS NULL THEN RAISE EXCEPTION 'Refund must reference an invoice or payment'; END IF;

  IF p_invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  END IF;
  IF p_payment_id IS NOT NULL THEN
    SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
    IF v_payment.status::TEXT <> 'completed' THEN RAISE EXCEPTION 'Only completed payments can be refunded'; END IF;
  END IF;

  v_business := COALESCE(v_invoice.business, v_payment.business);
  IF v_invoice.id IS NOT NULL AND v_payment.id IS NOT NULL THEN
    IF v_invoice.business IS DISTINCT FROM v_payment.business THEN RAISE EXCEPTION 'Invoice and payment belong to different businesses'; END IF;
    IF v_payment.invoice_id IS DISTINCT FROM v_invoice.id
      AND NOT EXISTS (SELECT 1 FROM payment_allocations WHERE payment_id = v_payment.id AND invoice_id = v_invoice.id)
    THEN RAISE EXCEPTION 'Payment is not allocated to the selected invoice'; END IF;
  END IF;
  IF NOT accounting_can_see_business(v_business) THEN
    RAISE EXCEPTION 'Refund source not found or not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_payment.id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_previous_refunds FROM customer_refunds WHERE payment_id = v_payment.id AND status <> 'void';
    v_refundable_amount := ROUND(GREATEST(COALESCE(v_payment.amount, 0) - v_previous_refunds, 0), 2);
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO v_previous_refunds FROM customer_refunds WHERE invoice_id = v_invoice.id AND status <> 'void';
    v_refundable_amount := ROUND(GREATEST(COALESCE(v_invoice.paid_amount, 0) - v_previous_refunds, 0), 2);
  END IF;
  IF ROUND(p_amount, 2) > v_refundable_amount THEN RAISE EXCEPTION 'Refund amount exceeds remaining refundable amount of %', v_refundable_amount; END IF;

  v_contact_id := accounting_contact_for_profile(
    COALESCE(v_invoice.customer_id, v_payment.customer_id), COALESCE(v_invoice.customer_name, v_payment.customer_name),
    COALESCE(v_invoice.customer_phone, v_payment.phone_number), v_invoice.customer_email
  );
  v_refund_number := 'RF-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 6));
  v_cash_account := accounting_cash_account_id(p_method::TEXT);

  INSERT INTO customer_refunds (refund_number, contact_id, invoice_id, payment_id, amount, method, reference, reason, business, created_by)
  VALUES (v_refund_number, v_contact_id, p_invoice_id, p_payment_id, ROUND(p_amount, 2), p_method, NULLIF(TRIM(p_reference), ''), TRIM(p_reason), v_business, auth.uid())
  RETURNING id INTO v_refund_id;

  -- The credit note reverses revenue/VAT and clears the temporary A/R debit
  -- created by the cash-out entry below. A paid invoice stays settled at zero.
  IF v_invoice.id IS NOT NULL THEN
    v_tax_rate := CASE
      WHEN COALESCE(v_invoice.vat_rate, 0) > 1 THEN v_invoice.vat_rate / 100
      ELSE COALESCE(v_invoice.vat_rate, 0)
    END;
    v_credit_subtotal := CASE
      WHEN v_tax_rate > 0 THEN ROUND(ROUND(p_amount, 2) / (1 + v_tax_rate), 2)
      ELSE ROUND(p_amount, 2)
    END;
    v_credit_tax := ROUND(ROUND(p_amount, 2) - v_credit_subtotal, 2);
    v_credit_note_number := 'CN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 6));

    INSERT INTO credit_notes (
      credit_note_number, invoice_id, contact_id, status, issue_date,
      subtotal, tax_total, total, applied_amount, reason, business, created_by
    ) VALUES (
      v_credit_note_number, v_invoice.id, v_contact_id, 'applied', CURRENT_DATE,
      v_credit_subtotal, v_credit_tax, ROUND(p_amount, 2), ROUND(p_amount, 2),
      'Refund ' || v_refund_number || ': ' || TRIM(p_reason), v_business, auth.uid()
    ) RETURNING id INTO v_credit_note_id;

    INSERT INTO credit_note_lines (
      credit_note_id, description_snapshot, quantity, unit_price,
      tax_amount, line_total, revenue_account_id
    ) VALUES (
      v_credit_note_id, 'Refund ' || v_refund_number, 1, v_credit_subtotal,
      v_credit_tax, ROUND(p_amount, 2), accounting_system_account_id('sales_revenue')
    );

    v_credit_post := post_credit_note_to_ledger(v_credit_note_id);
    IF NOT COALESCE((v_credit_post->>'success')::BOOLEAN, FALSE) THEN
      RAISE EXCEPTION 'Refund credit note failed: %', COALESCE(v_credit_post->>'error', 'unknown error');
    END IF;

    UPDATE customer_refunds SET credit_note_id = v_credit_note_id WHERE id = v_refund_id;
  END IF;

  v_entry_id := post_journal_entry(
    'manual_adjustment', v_refund_id, CURRENT_DATE, 'Customer refund: ' || v_refund_number,
    jsonb_build_array(
      jsonb_build_object('account_id', v_ar_account, 'debit', ROUND(p_amount, 2), 'contact_id', v_contact_id, 'description', 'Restore receivable/customer credit for refund'),
      jsonb_build_object('account_id', v_cash_account, 'credit', ROUND(p_amount, 2), 'contact_id', v_contact_id, 'description', 'Cash refunded to customer')
    ), v_business
  );
  UPDATE customer_refunds SET posted_journal_entry_id = v_entry_id WHERE id = v_refund_id;
  RETURN jsonb_build_object(
    'success', true,
    'refund_id', v_refund_id,
    'refund_number', v_refund_number,
    'journal_entry_id', v_entry_id,
    'credit_note_id', v_credit_note_id,
    'credit_note_number', v_credit_note_number,
    'credit_note_journal_entry_id', v_credit_post->>'journal_entry_id'
  );
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.record_customer_refund(UUID, UUID, NUMERIC, payment_method, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_customer_refund(UUID, UUID, NUMERIC, payment_method, TEXT, TEXT) TO authenticated, service_role;

