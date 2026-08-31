-- B3: business-aware CRUD. Business is chosen only when a top-level document
-- (invoice/bill) is created; child documents inherit it. Expenses are
-- client-side inserts already scoped by the 080 RLS WITH CHECK.

-- Resolve the business a WRITE should use. super_admin: p_business or default
-- expresswash (validated); regular admin: forced to expresswash, else RAISE.
CREATE OR REPLACE FUNCTION accounting_write_business(p_business TEXT)
RETURNS TEXT AS $$
DECLARE
  v TEXT;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v := NULLIF(TRIM(p_business), '');
  IF is_super_admin() THEN
    IF v IS NULL THEN RETURN 'expresswash'; END IF;
    RETURN accounting_resolve_business(v);
  END IF;
  IF v IS NULL OR v = 'expresswash' THEN RETURN 'expresswash'; END IF;
  RAISE EXCEPTION 'Not authorized to write business %', v USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION accounting_write_business(TEXT) TO authenticated, service_role;

-- Extend source->business resolution to the manual_adjustment entries emitted by
-- refunds (source_id = customer_refund) and credit allocation (source_id = payment),
-- so those reclassifications land under the right business (incl. expresswash).
CREATE OR REPLACE FUNCTION accounting_source_business(p_source_type TEXT, p_source_id UUID)
RETURNS TEXT AS $$
DECLARE
  v TEXT;
BEGIN
  IF p_source_id IS NULL THEN
    RETURN NULL;
  END IF;
  CASE p_source_type
    WHEN 'invoice'          THEN SELECT business INTO v FROM invoices              WHERE id = p_source_id;
    WHEN 'payment_received' THEN SELECT business INTO v FROM payments              WHERE id = p_source_id;
    WHEN 'bill'             THEN SELECT business INTO v FROM bills                 WHERE id = p_source_id;
    WHEN 'payment_made'     THEN SELECT business INTO v FROM payments_made         WHERE id = p_source_id;
    WHEN 'credit_note'      THEN SELECT business INTO v FROM credit_notes          WHERE id = p_source_id;
    WHEN 'expense'          THEN SELECT business INTO v FROM expenses              WHERE id = p_source_id;
    WHEN 'reversal'         THEN SELECT business INTO v FROM ledger_journal_entries WHERE id = p_source_id;
    WHEN 'manual_adjustment' THEN
      SELECT COALESCE(
        (SELECT COALESCE(i.business, pp.business)
           FROM customer_refunds r
           LEFT JOIN invoices i  ON i.id  = r.invoice_id
           LEFT JOIN payments  pp ON pp.id = r.payment_id
          WHERE r.id = p_source_id),
        (SELECT business FROM payments WHERE id = p_source_id)
      ) INTO v;
    ELSE v := NULL;
  END CASE;
  RETURN v;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ── Child documents inherit business from their parent (triggers only set,
--    never block, so operational customer/driver payment flows are unaffected) ──
CREATE OR REPLACE FUNCTION accounting_payments_inherit_business()
RETURNS trigger AS $$
DECLARE v TEXT;
BEGIN
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT business INTO v FROM invoices WHERE id = NEW.invoice_id;
    IF v IS NOT NULL THEN NEW.business := v; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_payments_inherit_business ON payments;
CREATE TRIGGER trg_payments_inherit_business
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION accounting_payments_inherit_business();

CREATE OR REPLACE FUNCTION accounting_credit_notes_inherit_business()
RETURNS trigger AS $$
DECLARE v TEXT;
BEGIN
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT business INTO v FROM invoices WHERE id = NEW.invoice_id;
    IF v IS NOT NULL THEN NEW.business := v; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_credit_notes_inherit_business ON credit_notes;
CREATE TRIGGER trg_credit_notes_inherit_business
  BEFORE INSERT ON credit_notes
  FOR EACH ROW EXECUTE FUNCTION accounting_credit_notes_inherit_business();

-- payments_made has no direct bill link at insert; derive it from the allocation.
CREATE OR REPLACE FUNCTION accounting_payments_made_inherit_business()
RETURNS trigger AS $$
DECLARE v TEXT;
BEGIN
  SELECT business INTO v FROM bills WHERE id = NEW.bill_id;
  IF v IS NOT NULL THEN
    UPDATE payments_made SET business = v WHERE id = NEW.payment_made_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_payments_made_inherit_business ON payment_made_allocations;
CREATE TRIGGER trg_payments_made_inherit_business
  AFTER INSERT ON payment_made_allocations
  FOR EACH ROW EXECUTE FUNCTION accounting_payments_made_inherit_business();

-- Integrity: a payment can only be allocated to invoices of the same business.
CREATE OR REPLACE FUNCTION accounting_payment_allocations_same_business()
RETURNS trigger AS $$
DECLARE v_pay TEXT; v_inv TEXT;
BEGIN
  SELECT business INTO v_pay FROM payments WHERE id = NEW.payment_id;
  SELECT business INTO v_inv FROM invoices WHERE id = NEW.invoice_id;
  IF v_pay IS DISTINCT FROM v_inv THEN
    RAISE EXCEPTION 'Cannot allocate a % payment to a % invoice',
      COALESCE(v_pay, '(none)'), COALESCE(v_inv, '(none)')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_payment_allocations_same_business ON payment_allocations;
CREATE TRIGGER trg_payment_allocations_same_business
  BEFORE INSERT ON payment_allocations
  FOR EACH ROW EXECUTE FUNCTION accounting_payment_allocations_same_business();

-- ── Top-level creates take p_business (DROP+recreate: new signature) ───
DROP FUNCTION IF EXISTS create_invoice_with_lines(UUID, DATE, DATE, TEXT, JSONB, invoice_status, BOOLEAN);
CREATE OR REPLACE FUNCTION create_invoice_with_lines(
  p_contact_id UUID,
  p_issue_date DATE,
  p_due_date DATE,
  p_notes TEXT,
  p_lines JSONB,
  p_status invoice_status DEFAULT 'pending',
  p_post BOOLEAN DEFAULT FALSE,
  p_business TEXT DEFAULT NULL
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
  v_business TEXT;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can create invoices';
  END IF;

  v_business := accounting_write_business(p_business);

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
    invoice_number, customer_id, customer_name, customer_email, customer_phone,
    items, subtotal, vat_rate, vat_amount, total, paid_amount, balance,
    status, due_date, due_at, issued_at, notes, business, created_at, updated_at
  ) VALUES (
    v_invoice_number, v_contact.app_user_id, v_contact.name, v_contact.email, v_contact.phone,
    '[]'::jsonb, 0, 0.16, 0, 0, 0, 0,
    p_status, p_due_date, p_due_date::TIMESTAMPTZ,
    COALESCE(p_issue_date, CURRENT_DATE)::TIMESTAMPTZ, p_notes, v_business, NOW(), NOW()
  )
  RETURNING id INTO v_invoice_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_item := NULL;
    IF NULLIF(v_line->>'item_id', '') IS NOT NULL THEN
      SELECT * INTO v_item FROM accounting_items WHERE id = (v_line->>'item_id')::UUID LIMIT 1;
    END IF;

    v_quantity := COALESCE(NULLIF(v_line->>'quantity', '')::NUMERIC, 1);
    v_unit_price := COALESCE(NULLIF(v_line->>'unit_price', '')::NUMERIC, COALESCE(v_item.default_price, 0));
    v_discount := COALESCE(NULLIF(v_line->>'discount_amount', '')::NUMERIC, 0);
    v_tax_rate_id := COALESCE(NULLIF(v_line->>'tax_rate_id', '')::UUID, v_item.tax_rate_id);
    v_revenue_account := COALESCE(NULLIF(v_line->>'revenue_account_id', '')::UUID, v_item.sales_account_id, accounting_system_account_id('sales_revenue'));

    SELECT COALESCE(rate, 0) INTO v_tax_rate FROM tax_rates WHERE id = v_tax_rate_id;
    v_tax_rate := COALESCE(v_tax_rate, 0);

    v_tax_amount := COALESCE(NULLIF(v_line->>'tax_amount', '')::NUMERIC, ROUND(GREATEST((v_quantity * v_unit_price) - v_discount, 0) * v_tax_rate, 2));
    v_line_total := ROUND(GREATEST((v_quantity * v_unit_price) - v_discount, 0) + v_tax_amount, 2);

    IF v_quantity <= 0 OR v_unit_price < 0 OR v_line_total <= 0 THEN
      RAISE EXCEPTION 'Invalid invoice line amount';
    END IF;

    INSERT INTO invoice_lines (
      invoice_id, item_id, description_snapshot, quantity, unit_price, discount_amount,
      tax_rate_id, tax_amount, line_total, revenue_account_id, metadata
    ) VALUES (
      v_invoice_id, v_item.id, COALESCE(NULLIF(v_line->>'description', ''), v_item.name, 'Invoice line'),
      v_quantity, v_unit_price, v_discount, v_tax_rate_id, v_tax_amount, v_line_total,
      v_revenue_account, COALESCE(v_line->'metadata', '{}'::jsonb)
    );
  END LOOP;

  v_totals := accounting_recalculate_invoice_totals(v_invoice_id);

  UPDATE invoices i
  SET items = COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', il.description_snapshot, 'quantity', il.quantity,
      'unit_price', il.unit_price, 'total', il.line_total
    ) ORDER BY il.created_at)
    FROM invoice_lines il WHERE il.invoice_id = i.id
  ), '[]'::jsonb)
  WHERE i.id = v_invoice_id;

  IF p_post THEN
    v_post := post_invoice_to_ledger(v_invoice_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number,
    'totals', v_totals, 'journal_entry_id', v_post->>'journal_entry_id'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION create_invoice_with_lines(UUID, DATE, DATE, TEXT, JSONB, invoice_status, BOOLEAN, TEXT) TO authenticated, service_role;

-- update_draft: never moves an invoice's business; just guard that the caller
-- may act on it (SECURITY DEFINER would otherwise bypass the 080 RLS).
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

  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF NOT accounting_can_see_business(v_invoice.business) THEN
    RAISE EXCEPTION 'Not authorized for this invoice''s business' USING ERRCODE = 'insufficient_privilege';
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
  WHERE id = p_contact_id AND contact_type IN ('customer', 'both') AND active = TRUE;
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

  -- Reuse create_invoice_with_lines to build lines on a scratch invoice of the
  -- same business, then move them onto this invoice.
  v_result := create_invoice_with_lines(p_contact_id, p_issue_date, p_due_date, p_notes, p_lines, p_status, FALSE, v_invoice.business);
  IF (v_result->>'success')::BOOLEAN IS NOT TRUE THEN
    RAISE EXCEPTION '%', v_result->>'error';
  END IF;

  UPDATE invoice_lines SET invoice_id = p_invoice_id WHERE invoice_id = (v_result->>'invoice_id')::UUID;
  DELETE FROM invoices WHERE id = (v_result->>'invoice_id')::UUID;

  PERFORM accounting_recalculate_invoice_totals(p_invoice_id);

  UPDATE invoices i
  SET items = COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', il.description_snapshot, 'quantity', il.quantity,
      'unit_price', il.unit_price, 'total', il.line_total
    ) ORDER BY il.created_at)
    FROM invoice_lines il WHERE il.invoice_id = i.id
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

DROP FUNCTION IF EXISTS create_bill_with_lines(UUID, DATE, DATE, TEXT, JSONB, BOOLEAN);
CREATE OR REPLACE FUNCTION create_bill_with_lines(
  p_supplier_contact_id UUID,
  p_issue_date DATE,
  p_due_date DATE,
  p_notes TEXT,
  p_lines JSONB,
  p_post BOOLEAN DEFAULT TRUE,
  p_business TEXT DEFAULT NULL
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
  v_business TEXT;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can create bills';
  END IF;

  v_business := accounting_write_business(p_business);

  IF p_supplier_contact_id IS NULL THEN
    RAISE EXCEPTION 'Supplier is required';
  END IF;

  IF COALESCE(jsonb_typeof(p_lines), '') <> 'array' OR COALESCE(jsonb_array_length(p_lines), 0) = 0 THEN
    RAISE EXCEPTION 'At least one bill line is required';
  END IF;

  v_bill_number := 'BILL-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 6));

  INSERT INTO bills (
    bill_number, supplier_contact_id, status, issue_date, due_date, notes, business, created_by
  ) VALUES (
    v_bill_number, p_supplier_contact_id,
    CASE WHEN p_post THEN 'open' ELSE 'draft' END,
    COALESCE(p_issue_date, CURRENT_DATE), p_due_date, p_notes, v_business, auth.uid()
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
      bill_id, item_id, description_snapshot, quantity, unit_price, discount_amount,
      tax_rate_id, tax_amount, line_total, expense_account_id, metadata
    ) VALUES (
      v_bill_id, NULLIF(v_line->>'item_id', '')::UUID,
      COALESCE(NULLIF(v_line->>'description', ''), 'Bill line'),
      v_quantity, v_unit_price, v_discount, v_tax_rate, v_tax_amount, v_line_total,
      v_expense_account, COALESCE(v_line->'metadata', '{}'::jsonb)
    );

    v_subtotal := v_subtotal + ROUND(GREATEST((v_quantity * v_unit_price) - v_discount, 0), 2);
    v_tax_total := v_tax_total + v_tax_amount;
    v_total := v_total + v_line_total;
  END LOOP;

  UPDATE bills
  SET subtotal = ROUND(v_subtotal, 2), tax_total = ROUND(v_tax_total, 2),
      total = ROUND(v_total, 2), balance_due = ROUND(v_total, 2), updated_at = NOW()
  WHERE id = v_bill_id;

  IF p_post THEN
    PERFORM post_bill_to_ledger(v_bill_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'bill_id', v_bill_id, 'bill_number', v_bill_number);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION create_bill_with_lines(UUID, DATE, DATE, TEXT, JSONB, BOOLEAN, TEXT) TO authenticated, service_role;
