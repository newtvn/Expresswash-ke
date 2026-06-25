-- ============================================================
-- Invoice editor, multi-invoice allocations, and refund tracking
--
-- Adds transaction-safe RPCs for the remaining Zoho-like admin flows:
-- - create/update invoices with canonical invoice_lines
-- - allocate one customer payment across multiple invoices
-- - record customer refunds as auditable records
-- ============================================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS unapplied_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unapplied_amount >= 0);

CREATE TABLE IF NOT EXISTS customer_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number TEXT NOT NULL UNIQUE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method payment_method NOT NULL DEFAULT 'mpesa',
  reference TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'void')),
  posted_journal_entry_id UUID REFERENCES ledger_journal_entries(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customer_refunds_contact ON customer_refunds(contact_id);
CREATE INDEX IF NOT EXISTS idx_customer_refunds_invoice ON customer_refunds(invoice_id);
CREATE INDEX IF NOT EXISTS idx_customer_refunds_payment ON customer_refunds(payment_id);

ALTER TABLE customer_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_refunds_admin_all" ON customer_refunds;
CREATE POLICY "customer_refunds_admin_all" ON customer_refunds
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

CREATE OR REPLACE FUNCTION accounting_recalculate_invoice_totals(p_invoice_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_subtotal NUMERIC(12,2);
  v_tax_total NUMERIC(12,2);
  v_discount_total NUMERIC(12,2);
  v_total NUMERIC(12,2);
  v_paid NUMERIC(12,2);
  v_credit_total NUMERIC(12,2);
  v_balance NUMERIC(12,2);
  v_status invoice_status;
BEGIN
  SELECT
    ROUND(COALESCE(SUM(GREATEST(line_total - COALESCE(tax_amount, 0), 0)), 0), 2),
    ROUND(COALESCE(SUM(COALESCE(tax_amount, 0)), 0), 2),
    ROUND(COALESCE(SUM(COALESCE(discount_amount, 0)), 0), 2),
    ROUND(COALESCE(SUM(COALESCE(line_total, 0)), 0), 2)
  INTO v_subtotal, v_tax_total, v_discount_total, v_total
  FROM invoice_lines
  WHERE invoice_id = p_invoice_id;

  SELECT
    ROUND(COALESCE(i.paid_amount, 0), 2),
    ROUND(COALESCE(SUM(COALESCE(cn.applied_amount, cn.total, 0)), 0), 2)
  INTO v_paid, v_credit_total
  FROM invoices i
  LEFT JOIN credit_notes cn
    ON cn.invoice_id = i.id
   AND cn.status::TEXT IN ('applied', 'issued')
  WHERE i.id = p_invoice_id
  GROUP BY i.id, i.paid_amount;

  v_balance := ROUND(GREATEST(v_total - COALESCE(v_paid, 0) - COALESCE(v_credit_total, 0), 0), 2);
  v_status := CASE
    WHEN v_balance <= 0 AND (v_total > 0 OR COALESCE(v_paid, 0) > 0 OR COALESCE(v_credit_total, 0) > 0) THEN 'paid'::invoice_status
    WHEN COALESCE(v_paid, 0) > 0 OR COALESCE(v_credit_total, 0) > 0 THEN 'partial'::invoice_status
    ELSE 'pending'::invoice_status
  END;

  UPDATE invoices
  SET subtotal = v_subtotal,
      vat_amount = v_tax_total,
      total = v_total,
      balance = v_balance,
      status = CASE WHEN status::TEXT = 'draft' THEN status ELSE v_status END,
      updated_at = NOW()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'subtotal', v_subtotal,
    'tax_total', v_tax_total,
    'discount_total', v_discount_total,
    'total', v_total,
    'paid_amount', COALESCE(v_paid, 0),
    'credit_total', COALESCE(v_credit_total, 0),
    'balance', v_balance,
    'status', v_status::TEXT
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION create_invoice_with_lines(
  p_contact_id UUID,
  p_issue_date DATE,
  p_due_date DATE,
  p_notes TEXT,
  p_lines JSONB,
  p_status invoice_status DEFAULT 'pending',
  p_post BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
  v_contact contacts%ROWTYPE;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_line JSONB;
  v_item accounting_items%ROWTYPE;
  v_quantity NUMERIC(12,3);
  v_unit_price NUMERIC(12,2);
  v_discount NUMERIC(12,2);
  v_tax_rate_id UUID;
  v_tax_rate NUMERIC(8,4);
  v_tax_amount NUMERIC(12,2);
  v_line_total NUMERIC(12,2);
  v_revenue_account UUID;
  v_totals JSONB;
  v_post JSONB := NULL;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can create invoices';
  END IF;

  IF p_contact_id IS NULL THEN
    RAISE EXCEPTION 'Customer contact is required';
  END IF;

  IF COALESCE(jsonb_typeof(p_lines), '') <> 'array' OR COALESCE(jsonb_array_length(p_lines), 0) = 0 THEN
    RAISE EXCEPTION 'At least one invoice line is required';
  END IF;

  SELECT * INTO v_contact
  FROM contacts
  WHERE id = p_contact_id
    AND contact_type IN ('customer', 'both')
    AND active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer contact not found';
  END IF;

  v_invoice_number := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 6));

  INSERT INTO invoices (
    invoice_number,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    items,
    subtotal,
    vat_rate,
    vat_amount,
    total,
    paid_amount,
    balance,
    status,
    due_date,
    due_at,
    issued_at,
    notes,
    created_at,
    updated_at
  ) VALUES (
    v_invoice_number,
    v_contact.app_user_id,
    v_contact.name,
    v_contact.email,
    v_contact.phone,
    '[]'::jsonb,
    0,
    0.16,
    0,
    0,
    0,
    0,
    p_status,
    p_due_date,
    p_due_date::TIMESTAMPTZ,
    COALESCE(p_issue_date, CURRENT_DATE)::TIMESTAMPTZ,
    p_notes,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_invoice_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_item := NULL;
    IF NULLIF(v_line->>'item_id', '') IS NOT NULL THEN
      SELECT * INTO v_item
      FROM accounting_items
      WHERE id = (v_line->>'item_id')::UUID
      LIMIT 1;
    END IF;

    v_quantity := COALESCE(NULLIF(v_line->>'quantity', '')::NUMERIC, 1);
    v_unit_price := COALESCE(NULLIF(v_line->>'unit_price', '')::NUMERIC, COALESCE(v_item.default_price, 0));
    v_discount := COALESCE(NULLIF(v_line->>'discount_amount', '')::NUMERIC, 0);
    v_tax_rate_id := COALESCE(NULLIF(v_line->>'tax_rate_id', '')::UUID, v_item.tax_rate_id);
    v_revenue_account := COALESCE(NULLIF(v_line->>'revenue_account_id', '')::UUID, v_item.sales_account_id, accounting_system_account_id('sales_revenue'));

    SELECT COALESCE(rate, 0)
    INTO v_tax_rate
    FROM tax_rates
    WHERE id = v_tax_rate_id;
    v_tax_rate := COALESCE(v_tax_rate, 0);

    v_tax_amount := COALESCE(NULLIF(v_line->>'tax_amount', '')::NUMERIC, ROUND(GREATEST((v_quantity * v_unit_price) - v_discount, 0) * v_tax_rate, 2));
    v_line_total := ROUND(GREATEST((v_quantity * v_unit_price) - v_discount, 0) + v_tax_amount, 2);

    IF v_quantity <= 0 OR v_unit_price < 0 OR v_line_total <= 0 THEN
      RAISE EXCEPTION 'Invalid invoice line amount';
    END IF;

    INSERT INTO invoice_lines (
      invoice_id,
      item_id,
      description_snapshot,
      quantity,
      unit_price,
      discount_amount,
      tax_rate_id,
      tax_amount,
      line_total,
      revenue_account_id,
      metadata
    ) VALUES (
      v_invoice_id,
      v_item.id,
      COALESCE(NULLIF(v_line->>'description', ''), v_item.name, 'Invoice line'),
      v_quantity,
      v_unit_price,
      v_discount,
      v_tax_rate_id,
      v_tax_amount,
      v_line_total,
      v_revenue_account,
      COALESCE(v_line->'metadata', '{}'::jsonb)
    );
  END LOOP;

  v_totals := accounting_recalculate_invoice_totals(v_invoice_id);

  UPDATE invoices i
  SET items = COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', il.description_snapshot,
      'quantity', il.quantity,
      'unit_price', il.unit_price,
      'total', il.line_total
    ) ORDER BY il.created_at)
    FROM invoice_lines il
    WHERE il.invoice_id = i.id
  ), '[]'::jsonb)
  WHERE i.id = v_invoice_id;

  IF p_post THEN
    v_post := post_invoice_to_ledger(v_invoice_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'totals', v_totals,
    'journal_entry_id', v_post->>'journal_entry_id'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION update_draft_invoice_with_lines(
  p_invoice_id UUID,
  p_contact_id UUID,
  p_issue_date DATE,
  p_due_date DATE,
  p_notes TEXT,
  p_lines JSONB,
  p_status invoice_status DEFAULT 'pending',
  p_post BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_contact contacts%ROWTYPE;
  v_result JSONB;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can update invoices';
  END IF;

  SELECT * INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_invoice.posted_journal_entry_id IS NOT NULL
    OR COALESCE(v_invoice.paid_amount, 0) > 0
    OR EXISTS (SELECT 1 FROM payment_allocations WHERE invoice_id = p_invoice_id)
    OR EXISTS (SELECT 1 FROM credit_notes WHERE invoice_id = p_invoice_id AND status::TEXT <> 'void')
  THEN
    RAISE EXCEPTION 'Posted, paid, allocated, or credited invoices cannot be edited; use credit notes or reversals';
  END IF;

  SELECT * INTO v_contact
  FROM contacts
  WHERE id = p_contact_id
    AND contact_type IN ('customer', 'both')
    AND active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer contact not found';
  END IF;

  DELETE FROM invoice_lines WHERE invoice_id = p_invoice_id;

  UPDATE invoices
  SET customer_id = v_contact.app_user_id,
      customer_name = v_contact.name,
      customer_email = v_contact.email,
      customer_phone = v_contact.phone,
      due_date = p_due_date,
      due_at = p_due_date::TIMESTAMPTZ,
      issued_at = COALESCE(p_issue_date, CURRENT_DATE)::TIMESTAMPTZ,
      notes = p_notes,
      status = p_status,
      updated_at = NOW()
  WHERE id = p_invoice_id;

  v_result := create_invoice_with_lines(p_contact_id, p_issue_date, p_due_date, p_notes, p_lines, p_status, FALSE);
  IF (v_result->>'success')::BOOLEAN IS NOT TRUE THEN
    RAISE EXCEPTION '%', v_result->>'error';
  END IF;

  UPDATE invoice_lines
  SET invoice_id = p_invoice_id
  WHERE invoice_id = (v_result->>'invoice_id')::UUID;

  DELETE FROM invoices WHERE id = (v_result->>'invoice_id')::UUID;

  PERFORM accounting_recalculate_invoice_totals(p_invoice_id);

  UPDATE invoices i
  SET items = COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', il.description_snapshot,
      'quantity', il.quantity,
      'unit_price', il.unit_price,
      'total', il.line_total
    ) ORDER BY il.created_at)
    FROM invoice_lines il
    WHERE il.invoice_id = i.id
  ), '[]'::jsonb)
  WHERE i.id = p_invoice_id;

  IF p_post THEN
    PERFORM post_invoice_to_ledger(p_invoice_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION allocate_customer_payment(
  p_payment_id UUID,
  p_allocations JSONB
) RETURNS JSONB AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_alloc JSONB;
  v_invoice invoices%ROWTYPE;
  v_amount NUMERIC(12,2);
  v_total_allocated NUMERIC(12,2) := 0;
  v_new_paid NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_existing RECORD;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can allocate payments';
  END IF;

  IF COALESCE(jsonb_typeof(p_allocations), '') <> 'array' OR COALESCE(jsonb_array_length(p_allocations), 0) = 0 THEN
    RAISE EXCEPTION 'At least one allocation is required';
  END IF;

  SELECT * INTO v_payment
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF v_payment.status::TEXT <> 'completed' THEN
    RAISE EXCEPTION 'Only completed payments can be allocated';
  END IF;

  FOR v_existing IN
    SELECT pa.invoice_id, pa.amount_allocated, i.total, i.paid_amount, i.balance
    FROM payment_allocations pa
    JOIN invoices i ON i.id = pa.invoice_id
    WHERE pa.payment_id = p_payment_id
    FOR UPDATE OF i
  LOOP
    UPDATE invoices
    SET paid_amount = ROUND(GREATEST(COALESCE(paid_amount, 0) - COALESCE(v_existing.amount_allocated, 0), 0), 2),
        balance = ROUND(LEAST(
          COALESCE(total, 0),
          COALESCE(balance, GREATEST(COALESCE(total, 0) - COALESCE(paid_amount, 0), 0)) + COALESCE(v_existing.amount_allocated, 0)
        ), 2),
        status = CASE
          WHEN ROUND(LEAST(
            COALESCE(total, 0),
            COALESCE(balance, GREATEST(COALESCE(total, 0) - COALESCE(paid_amount, 0), 0)) + COALESCE(v_existing.amount_allocated, 0)
          ), 2) <= 0 THEN 'paid'::invoice_status
          WHEN ROUND(GREATEST(COALESCE(paid_amount, 0) - COALESCE(v_existing.amount_allocated, 0), 0), 2) > 0 THEN 'partial'::invoice_status
          ELSE 'pending'::invoice_status
        END,
        updated_at = NOW()
    WHERE id = v_existing.invoice_id;
  END LOOP;

  DELETE FROM payment_allocations WHERE payment_id = p_payment_id;

  FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    v_amount := ROUND(COALESCE(NULLIF(v_alloc->>'amount', '')::NUMERIC, 0), 2);
    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'Allocation amount must be greater than zero';
    END IF;

    SELECT * INTO v_invoice
    FROM invoices
    WHERE id = (v_alloc->>'invoice_id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invoice not found for allocation';
    END IF;

    IF v_invoice.customer_id IS DISTINCT FROM v_payment.customer_id
      AND lower(COALESCE(v_invoice.customer_name, '')) IS DISTINCT FROM lower(COALESCE(v_payment.customer_name, ''))
    THEN
      RAISE EXCEPTION 'Payment and invoice belong to different customers';
    END IF;

    v_total_allocated := ROUND(v_total_allocated + v_amount, 2);
    IF v_total_allocated > ROUND(COALESCE(v_payment.amount, 0), 2) THEN
      RAISE EXCEPTION 'Allocations exceed payment amount';
    END IF;

    IF v_amount > ROUND(COALESCE(v_invoice.balance, GREATEST(v_invoice.total - COALESCE(v_invoice.paid_amount, 0), 0)), 2) THEN
      RAISE EXCEPTION 'Allocation exceeds invoice balance';
    END IF;

    INSERT INTO payment_allocations (payment_id, invoice_id, amount_allocated, created_by)
    VALUES (p_payment_id, v_invoice.id, v_amount, auth.uid());

    v_new_paid := ROUND(COALESCE(v_invoice.paid_amount, 0) + v_amount, 2);
    v_new_balance := ROUND(GREATEST(COALESCE(v_invoice.balance, GREATEST(v_invoice.total - COALESCE(v_invoice.paid_amount, 0), 0)) - v_amount, 0), 2);

    UPDATE invoices
    SET paid_amount = v_new_paid,
        balance = v_new_balance,
        status = CASE
          WHEN v_new_balance <= 0 THEN 'paid'::invoice_status
          WHEN v_new_paid > 0 THEN 'partial'::invoice_status
          ELSE status
        END,
        paid_at = CASE WHEN v_new_balance <= 0 THEN NOW() ELSE paid_at END,
        updated_at = NOW()
    WHERE id = v_invoice.id;
  END LOOP;

  UPDATE payments
  SET unapplied_amount = ROUND(GREATEST(COALESCE(amount, 0) - v_total_allocated, 0), 2),
      updated_at = NOW()
  WHERE id = p_payment_id;

  IF v_total_allocated > 0 AND v_payment.posted_journal_entry_id IS NULL THEN
    PERFORM post_payment_received_to_ledger(p_payment_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'allocated_amount', v_total_allocated, 'unapplied_amount', GREATEST(COALESCE(v_payment.amount, 0) - v_total_allocated, 0));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can record refunds';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be greater than zero';
  END IF;

  IF p_invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  END IF;

  IF p_payment_id IS NOT NULL THEN
    SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
  END IF;

  IF p_invoice_id IS NOT NULL AND v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF p_payment_id IS NOT NULL AND v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF p_invoice_id IS NULL AND p_payment_id IS NULL THEN
    RAISE EXCEPTION 'Refund must reference an invoice or payment';
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

GRANT SELECT, INSERT, UPDATE ON customer_refunds TO authenticated;
GRANT EXECUTE ON FUNCTION accounting_recalculate_invoice_totals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_invoice_with_lines(UUID, DATE, DATE, TEXT, JSONB, invoice_status, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION update_draft_invoice_with_lines(UUID, UUID, DATE, DATE, TEXT, JSONB, invoice_status, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION allocate_customer_payment(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION record_customer_refund(UUID, UUID, NUMERIC, payment_method, TEXT, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION accounting_recalculate_invoice_totals(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION create_invoice_with_lines(UUID, DATE, DATE, TEXT, JSONB, invoice_status, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION update_draft_invoice_with_lines(UUID, UUID, DATE, DATE, TEXT, JSONB, invoice_status, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION allocate_customer_payment(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION record_customer_refund(UUID, UUID, NUMERIC, payment_method, TEXT, TEXT) TO service_role;
