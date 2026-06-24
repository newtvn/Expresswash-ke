-- ============================================================
-- Operational accounting workflows
--
-- Adds accounting-safe RPCs for the Zoho-like admin workflows:
-- invoice posting, payment allocations, bill creation/payment,
-- credit notes, and ledger posting from operational documents.
-- ============================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS posted_journal_entry_id UUID REFERENCES ledger_journal_entries(id) ON DELETE SET NULL;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS posted_journal_entry_id UUID REFERENCES ledger_journal_entries(id) ON DELETE SET NULL;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS posted_journal_entry_id UUID REFERENCES ledger_journal_entries(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION accounting_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN TRUE;
  END IF;

  RETURN is_admin();
EXCEPTION WHEN undefined_function THEN
  RETURN COALESCE(auth.role(), '') = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION accounting_system_account_id(p_system_key TEXT)
RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
BEGIN
  SELECT id INTO v_account_id
  FROM chart_of_accounts
  WHERE system_key = p_system_key
    AND active = TRUE
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Missing active system account: %', p_system_key;
  END IF;

  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION accounting_contact_for_profile(
  p_profile_id UUID,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_contact_id UUID;
BEGIN
  IF NOT accounting_is_admin()
    AND p_profile_id IS DISTINCT FROM auth.uid()
  THEN
    RAISE EXCEPTION 'Cannot create accounting contact for another user';
  END IF;

  IF p_profile_id IS NOT NULL THEN
    SELECT id INTO v_contact_id
    FROM contacts
    WHERE app_user_id = p_profile_id
    LIMIT 1;
  END IF;

  IF v_contact_id IS NOT NULL THEN
    RETURN v_contact_id;
  END IF;

  IF COALESCE(NULLIF(p_name, ''), NULLIF(p_phone, ''), NULLIF(p_email, '')) IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO contacts (contact_type, name, phone, email, app_user_id, source)
  VALUES (
    'customer',
    COALESCE(NULLIF(p_name, ''), p_email, p_phone, 'Customer'),
    p_phone,
    p_email,
    p_profile_id,
    CASE WHEN p_profile_id IS NULL THEN 'admin' ELSE 'app' END
  )
  ON CONFLICT (app_user_id) WHERE app_user_id IS NOT NULL
  DO UPDATE SET
    name = EXCLUDED.name,
    phone = COALESCE(EXCLUDED.phone, contacts.phone),
    email = COALESCE(EXCLUDED.email, contacts.email),
    active = TRUE,
    updated_at = NOW()
  RETURNING id INTO v_contact_id;

  RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION accounting_cash_account_id(p_method TEXT)
RETURNS UUID AS $$
BEGIN
  RETURN CASE
    WHEN lower(COALESCE(p_method, '')) IN ('mpesa', 'm-pesa', 'mobile_money', 'qr_code') THEN accounting_system_account_id('mpesa')
    WHEN lower(COALESCE(p_method, '')) IN ('cash') THEN accounting_system_account_id('cash')
    ELSE accounting_system_account_id('bank')
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION post_invoice_to_ledger(p_invoice_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_invoice RECORD;
  v_contact_id UUID;
  v_entry_id UUID;
  v_ar_account UUID := accounting_system_account_id('accounts_receivable');
  v_sales_account UUID := accounting_system_account_id('sales_revenue');
  v_vat_account UUID := accounting_system_account_id('vat_payable');
  v_lines JSONB := '[]'::jsonb;
  v_revenue_lines JSONB;
  v_subtotal NUMERIC(12,2);
  v_tax_total NUMERIC(12,2);
  v_total NUMERIC(12,2);
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can post invoices';
  END IF;

  SELECT * INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_invoice.posted_journal_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'journal_entry_id', v_invoice.posted_journal_entry_id);
  END IF;

  IF v_invoice.status::TEXT IN ('draft', 'cancelled') THEN
    RAISE EXCEPTION 'Only issued/open invoices can be posted';
  END IF;

  v_contact_id := accounting_contact_for_profile(
    v_invoice.customer_id,
    v_invoice.customer_name,
    v_invoice.customer_phone,
    v_invoice.customer_email
  );
  v_total := ROUND(COALESCE(v_invoice.total, 0), 2);
  v_tax_total := ROUND(COALESCE(v_invoice.vat_amount, 0), 2);
  v_subtotal := ROUND(COALESCE(NULLIF(v_invoice.subtotal, 0), GREATEST(v_total - v_tax_total, 0)), 2);

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Invoice total must be greater than zero';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'account_id', COALESCE(revenue_account_id, v_sales_account),
    'credit', amount,
    'contact_id', v_contact_id,
    'tax_rate_id', tax_rate_id,
    'description', description
  ))
  INTO v_revenue_lines
  FROM (
    SELECT
      COALESCE(il.revenue_account_id, v_sales_account) AS revenue_account_id,
      il.tax_rate_id,
      COALESCE(NULLIF(il.description_snapshot, ''), v_invoice.invoice_number) AS description,
      ROUND(SUM(GREATEST(il.line_total - COALESCE(il.tax_amount, 0), 0)), 2) AS amount
    FROM invoice_lines il
    WHERE il.invoice_id = p_invoice_id
    GROUP BY COALESCE(il.revenue_account_id, v_sales_account), il.tax_rate_id, COALESCE(NULLIF(il.description_snapshot, ''), v_invoice.invoice_number)
    HAVING ROUND(SUM(GREATEST(il.line_total - COALESCE(il.tax_amount, 0), 0)), 2) > 0
  ) grouped;

  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_id', v_ar_account,
    'debit', v_total,
    'contact_id', v_contact_id,
    'description', 'Accounts receivable for ' || v_invoice.invoice_number
  ));

  IF COALESCE(jsonb_array_length(v_revenue_lines), 0) > 0 THEN
    v_lines := v_lines || v_revenue_lines;
  ELSE
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_sales_account,
      'credit', v_subtotal,
      'contact_id', v_contact_id,
      'description', 'Sales revenue for ' || v_invoice.invoice_number
    ));
  END IF;

  IF v_tax_total > 0 THEN
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_vat_account,
      'credit', v_tax_total,
      'contact_id', v_contact_id,
      'description', 'Output VAT for ' || v_invoice.invoice_number
    ));
  END IF;

  v_entry_id := post_journal_entry(
    'invoice',
    p_invoice_id,
    COALESCE(NULLIF(v_invoice.due_date, '')::DATE, v_invoice.due_at::DATE, v_invoice.issued_at::DATE, CURRENT_DATE),
    'Invoice posted: ' || v_invoice.invoice_number,
    v_lines
  );

  UPDATE invoices
  SET posted_journal_entry_id = v_entry_id,
      updated_at = NOW()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'journal_entry_id', v_entry_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION post_payment_received_to_ledger(p_payment_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_payment RECORD;
  v_contact_id UUID;
  v_entry_id UUID;
  v_cash_account UUID;
  v_ar_account UUID := accounting_system_account_id('accounts_receivable');
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can post payments';
  END IF;

  SELECT * INTO v_payment
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF v_payment.posted_journal_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'journal_entry_id', v_payment.posted_journal_entry_id);
  END IF;

  IF v_payment.status::TEXT <> 'completed' THEN
    RAISE EXCEPTION 'Only completed payments can be posted';
  END IF;

  v_contact_id := accounting_contact_for_profile(v_payment.customer_id, v_payment.customer_name, v_payment.phone_number, NULL);
  v_cash_account := accounting_cash_account_id(v_payment.method::TEXT);

  v_entry_id := post_journal_entry(
    'payment_received',
    p_payment_id,
    COALESCE(v_payment.completed_at::DATE, v_payment.created_at::DATE, CURRENT_DATE),
    'Payment received' || COALESCE(' - ' || v_payment.reference, ''),
    jsonb_build_array(
      jsonb_build_object(
        'account_id', v_cash_account,
        'debit', ROUND(COALESCE(v_payment.amount, 0), 2),
        'contact_id', v_contact_id,
        'description', 'Cash received'
      ),
      jsonb_build_object(
        'account_id', v_ar_account,
        'credit', ROUND(COALESCE(v_payment.amount, 0), 2),
        'contact_id', v_contact_id,
        'description', 'Reduce accounts receivable'
      )
    )
  );

  UPDATE payments
  SET posted_journal_entry_id = v_entry_id,
      updated_at = NOW()
  WHERE id = p_payment_id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'journal_entry_id', v_entry_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

CREATE OR REPLACE FUNCTION complete_payment_transaction(
  p_payment_id UUID,
  p_order_id UUID,
  p_transaction_id TEXT,
  p_result_code INTEGER,
  p_result_desc TEXT
) RETURNS JSONB AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_payment_status TEXT;
  v_invoice RECORD;
  v_remaining NUMERIC(12,2);
  v_allocate NUMERIC(12,2);
  v_posted_invoice_count INTEGER := 0;
  v_allocation_count INTEGER := 0;
  v_payment_post JSONB := NULL;
BEGIN
  v_payment_status := CASE
    WHEN p_result_code = 0 THEN 'completed'
    WHEN p_result_code = 3 THEN 'cancelled'
    ELSE 'failed'
  END;

  SELECT * INTO v_payment
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  UPDATE payments
  SET status = v_payment_status::payment_status,
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
    SET status = 'paid',
        paid_at = COALESCE(paid_at, NOW()),
        paid_amount = total,
        balance = 0,
        updated_at = NOW()
    WHERE order_id = p_order_id
      AND status != 'paid';

    v_remaining := ROUND(COALESCE(v_payment.amount, 0), 2);

    FOR v_invoice IN
      SELECT *
      FROM invoices
      WHERE order_id = p_order_id
      ORDER BY created_at
    LOOP
      IF v_invoice.posted_journal_entry_id IS NULL THEN
        PERFORM post_invoice_to_ledger(v_invoice.id);
        v_posted_invoice_count := v_posted_invoice_count + 1;
      END IF;

      IF v_remaining > 0 THEN
        v_allocate := LEAST(v_remaining, ROUND(COALESCE(v_invoice.total, 0), 2));
        IF v_allocate > 0 THEN
          INSERT INTO payment_allocations (payment_id, invoice_id, amount_allocated, created_by)
          VALUES (p_payment_id, v_invoice.id, v_allocate, NULL)
          ON CONFLICT (payment_id, invoice_id)
          DO UPDATE SET amount_allocated = EXCLUDED.amount_allocated,
                        allocated_at = NOW();
          v_allocation_count := v_allocation_count + 1;
          v_remaining := ROUND(v_remaining - v_allocate, 2);
        END IF;
      END IF;
    END LOOP;

    IF v_allocation_count > 0 THEN
      v_payment_post := post_payment_received_to_ledger(p_payment_id);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_status', v_payment_status,
    'order_updated', v_payment_status = 'completed',
    'posted_invoice_count', v_posted_invoice_count,
    'allocation_count', v_allocation_count,
    'payment_journal_entry_id', v_payment_post->>'journal_entry_id'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION create_bill_with_lines(
  p_supplier_contact_id UUID,
  p_issue_date DATE,
  p_due_date DATE,
  p_notes TEXT,
  p_lines JSONB,
  p_post BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
  v_bill_id UUID;
  v_bill_number TEXT;
  v_line JSONB;
  v_subtotal NUMERIC(12,2) := 0;
  v_tax_total NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2) := 0;
  v_quantity NUMERIC(12,3);
  v_unit_price NUMERIC(12,2);
  v_discount NUMERIC(12,2);
  v_tax_amount NUMERIC(12,2);
  v_line_total NUMERIC(12,2);
  v_expense_account UUID;
  v_tax_rate UUID;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can create bills';
  END IF;

  IF p_supplier_contact_id IS NULL THEN
    RAISE EXCEPTION 'Supplier is required';
  END IF;

  IF COALESCE(jsonb_typeof(p_lines), '') <> 'array' OR COALESCE(jsonb_array_length(p_lines), 0) = 0 THEN
    RAISE EXCEPTION 'At least one bill line is required';
  END IF;

  v_bill_number := 'BILL-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 6));

  INSERT INTO bills (
    bill_number,
    supplier_contact_id,
    status,
    issue_date,
    due_date,
    notes,
    created_by
  ) VALUES (
    v_bill_number,
    p_supplier_contact_id,
    CASE WHEN p_post THEN 'open' ELSE 'draft' END,
    COALESCE(p_issue_date, CURRENT_DATE),
    p_due_date,
    p_notes,
    auth.uid()
  )
  RETURNING id INTO v_bill_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_quantity := COALESCE((v_line->>'quantity')::NUMERIC, 1);
    v_unit_price := COALESCE((v_line->>'unit_price')::NUMERIC, 0);
    v_discount := COALESCE((v_line->>'discount_amount')::NUMERIC, 0);
    v_tax_amount := COALESCE((v_line->>'tax_amount')::NUMERIC, 0);
    v_expense_account := COALESCE(NULLIF(v_line->>'expense_account_id', '')::UUID, accounting_system_account_id('other_expenses'));
    v_tax_rate := NULLIF(v_line->>'tax_rate_id', '')::UUID;
    v_line_total := ROUND(GREATEST((v_quantity * v_unit_price) - v_discount, 0) + v_tax_amount, 2);

    IF v_quantity <= 0 OR v_unit_price < 0 OR v_line_total <= 0 THEN
      RAISE EXCEPTION 'Invalid bill line amount';
    END IF;

    INSERT INTO bill_lines (
      bill_id,
      item_id,
      description_snapshot,
      quantity,
      unit_price,
      discount_amount,
      tax_rate_id,
      tax_amount,
      line_total,
      expense_account_id,
      metadata
    ) VALUES (
      v_bill_id,
      NULLIF(v_line->>'item_id', '')::UUID,
      COALESCE(NULLIF(v_line->>'description', ''), 'Bill line'),
      v_quantity,
      v_unit_price,
      v_discount,
      v_tax_rate,
      v_tax_amount,
      v_line_total,
      v_expense_account,
      COALESCE(v_line->'metadata', '{}'::jsonb)
    );

    v_subtotal := v_subtotal + ROUND(GREATEST((v_quantity * v_unit_price) - v_discount, 0), 2);
    v_tax_total := v_tax_total + v_tax_amount;
    v_total := v_total + v_line_total;
  END LOOP;

  UPDATE bills
  SET subtotal = ROUND(v_subtotal, 2),
      tax_total = ROUND(v_tax_total, 2),
      total = ROUND(v_total, 2),
      balance_due = ROUND(v_total, 2),
      updated_at = NOW()
  WHERE id = v_bill_id;

  IF p_post THEN
    PERFORM post_bill_to_ledger(v_bill_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'bill_id', v_bill_id, 'bill_number', v_bill_number);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION post_bill_to_ledger(p_bill_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_bill RECORD;
  v_entry_id UUID;
  v_ap_account UUID := accounting_system_account_id('accounts_payable');
  v_input_vat_account UUID := accounting_system_account_id('input_vat');
  v_expense_lines JSONB;
  v_lines JSONB := '[]'::jsonb;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can post bills';
  END IF;

  SELECT * INTO v_bill
  FROM bills
  WHERE id = p_bill_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;

  IF v_bill.posted_journal_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'journal_entry_id', v_bill.posted_journal_entry_id);
  END IF;

  IF v_bill.status = 'draft' THEN
    UPDATE bills SET status = 'open', updated_at = NOW() WHERE id = p_bill_id;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'account_id', expense_account_id,
    'debit', amount,
    'contact_id', v_bill.supplier_contact_id,
    'description', description
  ))
  INTO v_expense_lines
  FROM (
    SELECT
      COALESCE(expense_account_id, accounting_system_account_id('other_expenses')) AS expense_account_id,
      COALESCE(NULLIF(description_snapshot, ''), v_bill.bill_number) AS description,
      ROUND(SUM(GREATEST(line_total - COALESCE(tax_amount, 0), 0)), 2) AS amount
    FROM bill_lines
    WHERE bill_id = p_bill_id
    GROUP BY COALESCE(expense_account_id, accounting_system_account_id('other_expenses')), COALESCE(NULLIF(description_snapshot, ''), v_bill.bill_number)
    HAVING ROUND(SUM(GREATEST(line_total - COALESCE(tax_amount, 0), 0)), 2) > 0
  ) grouped;

  IF COALESCE(jsonb_array_length(v_expense_lines), 0) = 0 THEN
    RAISE EXCEPTION 'Bill has no expense lines to post';
  END IF;

  v_lines := v_lines || v_expense_lines;

  IF COALESCE(v_bill.tax_total, 0) > 0 THEN
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_input_vat_account,
      'debit', ROUND(v_bill.tax_total, 2),
      'contact_id', v_bill.supplier_contact_id,
      'description', 'Input VAT for ' || v_bill.bill_number
    ));
  END IF;

  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_id', v_ap_account,
    'credit', ROUND(v_bill.total, 2),
    'contact_id', v_bill.supplier_contact_id,
    'description', 'Accounts payable for ' || v_bill.bill_number
  ));

  v_entry_id := post_journal_entry(
    'bill',
    p_bill_id,
    COALESCE(v_bill.issue_date, CURRENT_DATE),
    'Bill posted: ' || v_bill.bill_number,
    v_lines
  );

  UPDATE bills
  SET posted_journal_entry_id = v_entry_id,
      status = CASE WHEN status = 'draft' THEN 'open' ELSE status END,
      updated_at = NOW()
  WHERE id = p_bill_id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'journal_entry_id', v_entry_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION record_bill_payment(
  p_bill_id UUID,
  p_amount NUMERIC,
  p_method TEXT DEFAULT 'bank_transfer',
  p_reference TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_bill RECORD;
  v_payment_made_id UUID;
  v_new_paid NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_new_status TEXT;
  v_post JSONB;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can record bill payments';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  SELECT * INTO v_bill
  FROM bills
  WHERE id = p_bill_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;

  IF v_bill.status = 'void' THEN
    RAISE EXCEPTION 'Cannot pay a void bill';
  END IF;

  IF v_bill.posted_journal_entry_id IS NULL THEN
    PERFORM post_bill_to_ledger(p_bill_id);
  END IF;

  IF ROUND(p_amount, 2) > ROUND(COALESCE(v_bill.balance_due, v_bill.total), 2) THEN
    RAISE EXCEPTION 'Payment amount exceeds bill balance';
  END IF;

  v_new_paid := ROUND(COALESCE(v_bill.amount_paid, 0) + p_amount, 2);
  v_new_balance := ROUND(GREATEST(COALESCE(v_bill.total, 0) - v_new_paid, 0), 2);
  v_new_status := CASE
    WHEN v_new_balance <= 0 THEN 'paid'
    WHEN v_new_paid > 0 THEN 'partially_paid'
    ELSE 'open'
  END;

  INSERT INTO payments_made (
    supplier_contact_id,
    payment_number,
    payment_date,
    amount,
    method,
    reference,
    status,
    created_by
  ) VALUES (
    v_bill.supplier_contact_id,
    'PMT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 6)),
    CURRENT_DATE,
    ROUND(p_amount, 2),
    p_method,
    p_reference,
    'confirmed',
    auth.uid()
  )
  RETURNING id INTO v_payment_made_id;

  INSERT INTO payment_made_allocations (payment_made_id, bill_id, amount_allocated, created_by)
  VALUES (v_payment_made_id, p_bill_id, ROUND(p_amount, 2), auth.uid());

  UPDATE bills
  SET amount_paid = v_new_paid,
      balance_due = v_new_balance,
      status = v_new_status,
      updated_at = NOW()
  WHERE id = p_bill_id;

  v_post := post_payment_made_to_ledger(v_payment_made_id);

  RETURN jsonb_build_object(
    'success', true,
    'payment_made_id', v_payment_made_id,
    'bill_id', p_bill_id,
    'amount_paid', v_new_paid,
    'balance_due', v_new_balance,
    'status', v_new_status,
    'journal_entry_id', v_post->>'journal_entry_id'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION post_payment_made_to_ledger(p_payment_made_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_payment RECORD;
  v_entry_id UUID;
  v_ap_account UUID := accounting_system_account_id('accounts_payable');
  v_cash_account UUID;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can post payments made';
  END IF;

  SELECT * INTO v_payment
  FROM payments_made
  WHERE id = p_payment_made_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment made not found';
  END IF;

  IF v_payment.posted_journal_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'journal_entry_id', v_payment.posted_journal_entry_id);
  END IF;

  IF v_payment.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed payments made can be posted';
  END IF;

  v_cash_account := accounting_cash_account_id(v_payment.method);

  v_entry_id := post_journal_entry(
    'payment_made',
    p_payment_made_id,
    COALESCE(v_payment.payment_date, CURRENT_DATE),
    'Payment made: ' || v_payment.payment_number,
    jsonb_build_array(
      jsonb_build_object(
        'account_id', v_ap_account,
        'debit', ROUND(v_payment.amount, 2),
        'contact_id', v_payment.supplier_contact_id,
        'description', 'Reduce accounts payable'
      ),
      jsonb_build_object(
        'account_id', v_cash_account,
        'credit', ROUND(v_payment.amount, 2),
        'contact_id', v_payment.supplier_contact_id,
        'description', 'Cash paid'
      )
    )
  );

  UPDATE payments_made
  SET posted_journal_entry_id = v_entry_id,
      updated_at = NOW()
  WHERE id = p_payment_made_id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'journal_entry_id', v_entry_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION create_credit_note_for_invoice(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_invoice RECORD;
  v_credit_note_id UUID;
  v_credit_note_number TEXT;
  v_contact_id UUID;
  v_tax_rate NUMERIC(7,4);
  v_subtotal NUMERIC(12,2);
  v_tax_total NUMERIC(12,2);
  v_total NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_new_paid NUMERIC(12,2);
  v_post JSONB;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can create credit notes';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be greater than zero';
  END IF;

  SELECT * INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_invoice.status::TEXT = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot credit a cancelled invoice';
  END IF;

  IF v_invoice.posted_journal_entry_id IS NULL THEN
    PERFORM post_invoice_to_ledger(p_invoice_id);
  END IF;

  v_total := ROUND(p_amount, 2);
  IF v_total > ROUND(COALESCE(v_invoice.balance, GREATEST(v_invoice.total - COALESCE(v_invoice.paid_amount, 0), 0)), 2) THEN
    RAISE EXCEPTION 'Credit amount cannot exceed invoice balance';
  END IF;

  v_tax_rate := CASE
    WHEN COALESCE(v_invoice.vat_rate, 0) > 1 THEN v_invoice.vat_rate / 100
    ELSE COALESCE(v_invoice.vat_rate, 0)
  END;
  v_subtotal := ROUND(v_total / (1 + COALESCE(NULLIF(v_tax_rate, 0), 0)), 2);
  v_tax_total := ROUND(v_total - v_subtotal, 2);
  v_contact_id := accounting_contact_for_profile(v_invoice.customer_id, v_invoice.customer_name, v_invoice.customer_phone, v_invoice.customer_email);
  v_credit_note_number := 'CN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 6));

  INSERT INTO credit_notes (
    credit_note_number,
    invoice_id,
    contact_id,
    status,
    issue_date,
    subtotal,
    tax_total,
    total,
    applied_amount,
    reason,
    created_by
  ) VALUES (
    v_credit_note_number,
    p_invoice_id,
    v_contact_id,
    'applied',
    CURRENT_DATE,
    v_subtotal,
    v_tax_total,
    v_total,
    v_total,
    p_reason,
    auth.uid()
  )
  RETURNING id INTO v_credit_note_id;

  INSERT INTO credit_note_lines (
    credit_note_id,
    description_snapshot,
    quantity,
    unit_price,
    tax_amount,
    line_total,
    revenue_account_id
  ) VALUES (
    v_credit_note_id,
    COALESCE(NULLIF(p_reason, ''), 'Credit for ' || v_invoice.invoice_number),
    1,
    v_subtotal,
    v_tax_total,
    v_total,
    accounting_system_account_id('sales_revenue')
  );

  v_post := post_credit_note_to_ledger(v_credit_note_id);

  v_new_paid := ROUND(COALESCE(v_invoice.paid_amount, 0), 2);
  v_new_balance := ROUND(GREATEST(COALESCE(v_invoice.balance, v_invoice.total - v_new_paid) - v_total, 0), 2);

  UPDATE invoices
  SET balance = v_new_balance,
      status = CASE
        WHEN v_new_balance <= 0 THEN 'paid'::invoice_status
        WHEN v_new_paid > 0 THEN 'partial'::invoice_status
        ELSE status
      END,
      updated_at = NOW()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'credit_note_id', v_credit_note_id,
    'credit_note_number', v_credit_note_number,
    'balance', v_new_balance,
    'journal_entry_id', v_post->>'journal_entry_id'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION post_credit_note_to_ledger(p_credit_note_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_credit_note RECORD;
  v_entry_id UUID;
  v_sales_account UUID := accounting_system_account_id('sales_revenue');
  v_vat_account UUID := accounting_system_account_id('vat_payable');
  v_ar_account UUID := accounting_system_account_id('accounts_receivable');
  v_lines JSONB := '[]'::jsonb;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can post credit notes';
  END IF;

  SELECT * INTO v_credit_note
  FROM credit_notes
  WHERE id = p_credit_note_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit note not found';
  END IF;

  IF v_credit_note.posted_journal_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'journal_entry_id', v_credit_note.posted_journal_entry_id);
  END IF;

  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_id', v_sales_account,
    'debit', ROUND(v_credit_note.subtotal, 2),
    'contact_id', v_credit_note.contact_id,
    'description', 'Reverse sales revenue for ' || v_credit_note.credit_note_number
  ));

  IF COALESCE(v_credit_note.tax_total, 0) > 0 THEN
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_vat_account,
      'debit', ROUND(v_credit_note.tax_total, 2),
      'contact_id', v_credit_note.contact_id,
      'description', 'Reverse output VAT for ' || v_credit_note.credit_note_number
    ));
  END IF;

  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_id', v_ar_account,
    'credit', ROUND(v_credit_note.total, 2),
    'contact_id', v_credit_note.contact_id,
    'description', 'Reduce accounts receivable for ' || v_credit_note.credit_note_number
  ));

  v_entry_id := post_journal_entry(
    'credit_note',
    p_credit_note_id,
    COALESCE(v_credit_note.issue_date, CURRENT_DATE),
    'Credit note posted: ' || v_credit_note.credit_note_number,
    v_lines
  );

  UPDATE credit_notes
  SET posted_journal_entry_id = v_entry_id,
      updated_at = NOW()
  WHERE id = p_credit_note_id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'journal_entry_id', v_entry_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION post_expense_to_ledger(p_expense_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_expense RECORD;
  v_entry_id UUID;
  v_expense_account UUID;
  v_cash_account UUID;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can post expenses';
  END IF;

  SELECT * INTO v_expense
  FROM expenses
  WHERE id = p_expense_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;

  IF v_expense.posted_journal_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'journal_entry_id', v_expense.posted_journal_entry_id);
  END IF;

  IF v_expense.status = 'rejected' THEN
    RAISE EXCEPTION 'Rejected expenses cannot be posted';
  END IF;

  v_expense_account := CASE v_expense.category
    WHEN 'supplies' THEN accounting_system_account_id('cleaning_supplies')
    WHEN 'salary' THEN accounting_system_account_id('staff_costs')
    WHEN 'rent' THEN accounting_system_account_id('rent')
    WHEN 'fuel' THEN accounting_system_account_id('transport')
    WHEN 'maintenance' THEN accounting_system_account_id('other_expenses')
    WHEN 'marketing' THEN accounting_system_account_id('other_expenses')
    WHEN 'utilities' THEN accounting_system_account_id('utilities')
    ELSE accounting_system_account_id('other_expenses')
  END;
  v_cash_account := accounting_cash_account_id(v_expense.payment_method);

  v_entry_id := post_journal_entry(
    'expense',
    p_expense_id,
    COALESCE(v_expense.expense_date, CURRENT_DATE),
    'Expense posted: ' || v_expense.description,
    jsonb_build_array(
      jsonb_build_object(
        'account_id', v_expense_account,
        'debit', ROUND(v_expense.amount, 2),
        'description', v_expense.description
      ),
      jsonb_build_object(
        'account_id', v_cash_account,
        'credit', ROUND(v_expense.amount, 2),
        'description', 'Cash paid for expense'
      )
    )
  );

  UPDATE expenses
  SET posted_journal_entry_id = v_entry_id
  WHERE id = p_expense_id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'journal_entry_id', v_entry_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION accounting_system_account_id(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION accounting_contact_for_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION accounting_cash_account_id(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION post_invoice_to_ledger(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION post_payment_received_to_ledger(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_invoice_payment(UUID, NUMERIC, payment_method, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_payment_transaction(UUID, UUID, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_payment_transaction(UUID, UUID, TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_bill_with_lines(UUID, DATE, DATE, TEXT, JSONB, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION post_bill_to_ledger(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_bill_payment(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION post_payment_made_to_ledger(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_credit_note_for_invoice(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION post_credit_note_to_ledger(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION post_expense_to_ledger(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION accounting_system_account_id(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION accounting_contact_for_profile(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION accounting_cash_account_id(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION post_invoice_to_ledger(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION post_payment_received_to_ledger(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION record_invoice_payment(UUID, NUMERIC, payment_method, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_bill_with_lines(UUID, DATE, DATE, TEXT, JSONB, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION post_bill_to_ledger(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION record_bill_payment(UUID, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION post_payment_made_to_ledger(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION create_credit_note_for_invoice(UUID, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION post_credit_note_to_ledger(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION post_expense_to_ledger(UUID) TO service_role;
