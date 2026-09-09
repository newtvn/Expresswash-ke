-- Audit-grade journal detail reads and business-safe reversal.

CREATE OR REPLACE FUNCTION get_ledger_journal_entries(
  p_limit INTEGER DEFAULT 50,
  p_business TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_business TEXT := accounting_effective_business(p_business);
BEGIN
  RETURN (
    WITH selected_entries AS (
      SELECT e.*
      FROM ledger_journal_entries e
      WHERE v_business IS NULL OR e.business = v_business
      ORDER BY e.entry_date DESC, e.created_at DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
    )
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'entry_number', e.entry_number,
        'source_type', e.source_type,
        'source_id', e.source_id,
        'source_reference', CASE e.source_type
          WHEN 'invoice' THEN (SELECT invoice_number FROM invoices WHERE id = e.source_id)
          WHEN 'payment_received' THEN (SELECT COALESCE(mpesa_receipt_number, reference_number, reference, id::TEXT) FROM payments WHERE id = e.source_id)
          WHEN 'bill' THEN (SELECT bill_number FROM bills WHERE id = e.source_id)
          WHEN 'payment_made' THEN (SELECT COALESCE(payment_number, reference, id::TEXT) FROM payments_made WHERE id = e.source_id)
          WHEN 'credit_note' THEN (SELECT credit_note_number FROM credit_notes WHERE id = e.source_id)
          WHEN 'expense' THEN (SELECT description FROM expenses WHERE id = e.source_id)
          WHEN 'reversal' THEN (SELECT 'Reversal of ' || entry_number FROM ledger_journal_entries WHERE id = e.source_id)
          WHEN 'external' THEN e.external_id
          ELSE NULL
        END,
        'business', e.business,
        'entry_date', e.entry_date,
        'memo', e.memo,
        'status', e.status,
        'amount', totals.total_debit,
        'total_debit', totals.total_debit,
        'total_credit', totals.total_credit,
        'reversed_entry_id', e.reversed_entry_id,
        'posted_at', e.posted_at,
        'created_at', e.created_at,
        'lines', totals.lines
      ) ORDER BY e.entry_date DESC, e.created_at DESC
    ), '[]'::jsonb)
    FROM selected_entries e
    CROSS JOIN LATERAL (
      SELECT
        COALESCE(SUM(l.debit), 0) AS total_debit,
        COALESCE(SUM(l.credit), 0) AS total_credit,
        COALESCE(jsonb_agg(jsonb_build_object(
          'id', l.id,
          'account_id', l.account_id,
          'account_code', coa.code,
          'account_name', coa.name,
          'description', l.description,
          'debit', l.debit,
          'credit', l.credit
        ) ORDER BY l.created_at, l.id), '[]'::jsonb) AS lines
      FROM ledger_journal_lines l
      JOIN chart_of_accounts coa ON coa.id = l.account_id
      WHERE l.journal_entry_id = e.id
    ) totals
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_ledger_journal_entries(INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_ledger_journal_entries(INTEGER, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION reverse_journal_entry(
  p_journal_entry_id UUID,
  p_entry_date DATE,
  p_memo TEXT
) RETURNS UUID AS $$
DECLARE
  v_original ledger_journal_entries%ROWTYPE;
  v_lines JSONB;
  v_reversal_id UUID;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can reverse journal entries' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_original
  FROM ledger_journal_entries
  WHERE id = p_journal_entry_id
  FOR UPDATE;

  IF NOT FOUND OR NOT accounting_can_see_business(v_original.business) THEN
    RAISE EXCEPTION 'Journal entry not found or not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_original.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted journal entries can be reversed';
  END IF;

  IF v_original.source_type = 'reversal' THEN
    RAISE EXCEPTION 'Reversal entries cannot be reversed';
  END IF;

  IF COALESCE(p_entry_date, CURRENT_DATE) < v_original.entry_date THEN
    RAISE EXCEPTION 'Reversal date cannot precede the original entry date';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'account_id', account_id,
    'debit', credit,
    'credit', debit,
    'contact_id', contact_id,
    'tax_rate_id', tax_rate_id,
    'description', COALESCE(description, '') || ' (reversal)',
    'metadata', metadata || jsonb_build_object('reverses_journal_entry_id', p_journal_entry_id)
  ) ORDER BY created_at, id)
  INTO v_lines
  FROM ledger_journal_lines
  WHERE journal_entry_id = p_journal_entry_id;

  IF COALESCE(jsonb_array_length(v_lines), 0) < 2 THEN
    RAISE EXCEPTION 'Original journal entry has no complete line set';
  END IF;

  v_reversal_id := post_journal_entry(
    'reversal',
    p_journal_entry_id,
    COALESCE(p_entry_date, CURRENT_DATE),
    COALESCE(NULLIF(TRIM(p_memo), ''), 'Reversal of ' || v_original.entry_number),
    v_lines,
    v_original.business
  );

  UPDATE ledger_journal_entries
  SET status = 'reversed', reversed_entry_id = v_reversal_id, updated_at = NOW()
  WHERE id = p_journal_entry_id;

  RETURN v_reversal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION reverse_journal_entry(UUID, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reverse_journal_entry(UUID, DATE, TEXT) TO authenticated, service_role;

-- Expense approval and ledger posting are one transaction. Direct status flips
-- can otherwise leave an "approved" expense absent from the P&L.
CREATE OR REPLACE FUNCTION approve_and_post_expense(p_expense_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_expense expenses%ROWTYPE;
  v_post_result JSONB;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can approve expenses' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_expense FROM expenses WHERE id = p_expense_id FOR UPDATE;
  IF NOT FOUND OR NOT accounting_can_see_business(v_expense.business) THEN
    RAISE EXCEPTION 'Expense not found or not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_expense.status = 'rejected' THEN
    RAISE EXCEPTION 'Rejected expenses cannot be approved';
  END IF;

  IF v_expense.status <> 'approved' THEN
    UPDATE expenses
    SET status = 'approved', approved_by = auth.uid(), approved_at = NOW()
    WHERE id = p_expense_id;
  END IF;

  v_post_result := post_expense_to_ledger(p_expense_id);
  RETURN v_post_result || jsonb_build_object('expense_id', p_expense_id, 'status', 'approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION reject_unposted_expense(p_expense_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_expense expenses%ROWTYPE;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can reject expenses' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_expense FROM expenses WHERE id = p_expense_id FOR UPDATE;
  IF NOT FOUND OR NOT accounting_can_see_business(v_expense.business) THEN
    RAISE EXCEPTION 'Expense not found or not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_expense.posted_journal_entry_id IS NOT NULL OR v_expense.status = 'approved' THEN
    RAISE EXCEPTION 'Posted expenses must be corrected with a journal reversal';
  END IF;

  UPDATE expenses SET status = 'rejected' WHERE id = p_expense_id;
  RETURN jsonb_build_object('success', true, 'expense_id', p_expense_id, 'status', 'rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION approve_and_post_expense(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION reject_unposted_expense(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION approve_and_post_expense(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION reject_unposted_expense(UUID) TO authenticated, service_role;

-- One reconciled cash-receipts feed. Native payments and external events use
-- different source tables, but only events that debit a cash account belong in
-- "Payments Received". Wallet redemptions/refunds are ledger movements, not cash receipts.
CREATE OR REPLACE FUNCTION get_accounting_payments_received(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_business TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_business TEXT := accounting_effective_business(p_business);
BEGIN
  RETURN (
    WITH received AS (
      SELECT
        p.id::TEXT AS id,
        'native'::TEXT AS source_kind,
        p.business,
        p.created_at,
        p.amount,
        'KES'::TEXT AS currency,
        p.method::TEXT,
        p.customer_name,
        p.provider,
        p.provider_status,
        p.mpesa_receipt_number,
        COALESCE(p.mpesa_receipt_number, p.reference_number, p.reference, p.checkout_request_id) AS reference,
        NULL::TEXT AS event_type,
        NULL::TEXT AS external_id,
        p.status::TEXT,
        p.unapplied_amount,
        p.posted_journal_entry_id,
        p.recorded_by,
        p.phone_number,
        p.payer_phone_number,
        p.payer_phone_matches_intent,
        p.merchant_request_id,
        p.checkout_request_id,
        p.result_desc
      FROM payments p
      WHERE p.status = 'completed'
        AND (p_from IS NULL OR p.created_at::DATE >= p_from)
        AND (p_to IS NULL OR p.created_at::DATE <= p_to)
        AND (v_business IS NULL OR p.business = v_business)

      UNION ALL

      SELECT
        ie.id::TEXT,
        'external'::TEXT,
        ie.business,
        COALESCE(ie.processed_at, ie.received_at),
        cash.cash_received,
        ie.currency,
        COALESCE(ie.payload->>'payment_method', ie.provider, 'external'),
        COALESCE(ie.payload->>'customer_name', ie.payload->>'payer_name', initcap(ie.source_system)),
        ie.provider,
        e.status,
        NULL::TEXT,
        ie.external_id,
        ie.event_type,
        ie.external_id,
        ie.status,
        0::NUMERIC,
        ie.journal_entry_id,
        NULL::TEXT,
        NULL::TEXT,
        NULL::TEXT,
        NULL::BOOLEAN,
        NULL::TEXT,
        NULL::TEXT,
        NULL::TEXT
      FROM ledger_ingest_events ie
      JOIN ledger_journal_entries e ON e.id = ie.journal_entry_id
      JOIN LATERAL (
        SELECT ROUND(SUM(l.debit), 2) AS cash_received
        FROM ledger_journal_lines l
        JOIN chart_of_accounts coa ON coa.id = l.account_id
        WHERE l.journal_entry_id = e.id
          AND coa.system_key IN ('cash', 'bank', 'mpesa', 'mpesa_goalhub')
          AND l.debit > 0
      ) cash ON cash.cash_received > 0
      WHERE ie.status = 'posted'
        AND ie.source_system = 'goalhub'
        AND e.status IN ('posted', 'reversed')
        AND (p_from IS NULL OR e.entry_date >= p_from)
        AND (p_to IS NULL OR e.entry_date <= p_to)
        AND (v_business IS NULL OR ie.business = v_business)
    )
    SELECT COALESCE(jsonb_agg(to_jsonb(received) ORDER BY created_at DESC), '[]'::jsonb)
    FROM received
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_accounting_payments_received(DATE, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_accounting_payments_received(DATE, DATE, TEXT) TO authenticated, service_role;

-- A reversed entry and its posted reversal must both remain in reports so the
-- pair nets to zero. Excluding the original while retaining the reversal would
-- manufacture the opposite transaction. Goalhub's M-Pesa account is cash too.
CREATE OR REPLACE FUNCTION get_ledger_profit_and_loss(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_business TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_income JSONB;
  v_expenses JSONB;
  v_total_income NUMERIC(12,2);
  v_total_expenses NUMERIC(12,2);
  v_business TEXT := accounting_effective_business(p_business);
BEGIN
  WITH account_totals AS (
    SELECT coa.id, coa.code, coa.name, coa.account_type,
      COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0) AS income_amount,
      COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS expense_amount
    FROM chart_of_accounts coa
    JOIN ledger_journal_lines l ON l.account_id = coa.id
    JOIN ledger_journal_entries e ON e.id = l.journal_entry_id
    WHERE e.status IN ('posted', 'reversed')
      AND coa.account_type IN ('income', 'expense')
      AND (p_from IS NULL OR e.entry_date >= p_from)
      AND (p_to IS NULL OR e.entry_date <= p_to)
      AND (v_business IS NULL OR e.business = v_business)
    GROUP BY coa.id, coa.code, coa.name, coa.account_type
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'amount', income_amount) ORDER BY code)
      FILTER (WHERE account_type = 'income'), '[]'::jsonb),
    COALESCE(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'amount', expense_amount) ORDER BY code)
      FILTER (WHERE account_type = 'expense'), '[]'::jsonb),
    COALESCE(SUM(income_amount) FILTER (WHERE account_type = 'income'), 0),
    COALESCE(SUM(expense_amount) FILTER (WHERE account_type = 'expense'), 0)
  INTO v_income, v_expenses, v_total_income, v_total_expenses
  FROM account_totals;

  RETURN jsonb_build_object(
    'from', p_from, 'to', p_to, 'income', v_income, 'expenses', v_expenses,
    'total_income', v_total_income, 'total_expenses', v_total_expenses,
    'net_profit', v_total_income - v_total_expenses
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_ledger_balance_sheet(
  p_as_of DATE DEFAULT CURRENT_DATE,
  p_business TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_assets JSONB;
  v_liabilities JSONB;
  v_equity JSONB;
  v_total_assets NUMERIC(12,2);
  v_total_liabilities NUMERIC(12,2);
  v_total_equity NUMERIC(12,2);
  v_current_earnings NUMERIC(12,2);
  v_business TEXT := accounting_effective_business(p_business);
BEGIN
  WITH account_totals AS (
    SELECT coa.id, coa.code, coa.name, coa.account_type, coa.normal_balance,
      CASE WHEN coa.normal_balance = 'debit'
        THEN COALESCE(SUM(l.debit) FILTER (WHERE e.id IS NOT NULL), 0)
          - COALESCE(SUM(l.credit) FILTER (WHERE e.id IS NOT NULL), 0)
        ELSE COALESCE(SUM(l.credit) FILTER (WHERE e.id IS NOT NULL), 0)
          - COALESCE(SUM(l.debit) FILTER (WHERE e.id IS NOT NULL), 0)
      END AS balance
    FROM chart_of_accounts coa
    LEFT JOIN ledger_journal_lines l ON l.account_id = coa.id
    LEFT JOIN ledger_journal_entries e ON e.id = l.journal_entry_id
      AND e.status IN ('posted', 'reversed')
      AND e.entry_date <= COALESCE(p_as_of, CURRENT_DATE)
      AND (v_business IS NULL OR e.business = v_business)
    WHERE coa.account_type IN ('asset', 'liability', 'equity') AND coa.active = TRUE
    GROUP BY coa.id, coa.code, coa.name, coa.account_type, coa.normal_balance
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'balance', balance) ORDER BY code)
      FILTER (WHERE account_type = 'asset'), '[]'::jsonb),
    COALESCE(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'balance', balance) ORDER BY code)
      FILTER (WHERE account_type = 'liability'), '[]'::jsonb),
    COALESCE(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'balance', balance) ORDER BY code)
      FILTER (WHERE account_type = 'equity'), '[]'::jsonb),
    COALESCE(SUM(balance) FILTER (WHERE account_type = 'asset'), 0),
    COALESCE(SUM(balance) FILTER (WHERE account_type = 'liability'), 0),
    COALESCE(SUM(balance) FILTER (WHERE account_type = 'equity'), 0)
  INTO v_assets, v_liabilities, v_equity, v_total_assets, v_total_liabilities, v_total_equity
  FROM account_totals;

  SELECT ROUND(COALESCE(SUM(l.credit - l.debit), 0), 2)
  INTO v_current_earnings
  FROM chart_of_accounts coa
  JOIN ledger_journal_lines l ON l.account_id = coa.id
  JOIN ledger_journal_entries e ON e.id = l.journal_entry_id
  WHERE e.status IN ('posted', 'reversed')
    AND e.entry_date <= COALESCE(p_as_of, CURRENT_DATE)
    AND coa.account_type IN ('income', 'expense') AND coa.active = TRUE
    AND (v_business IS NULL OR e.business = v_business);

  IF ABS(v_current_earnings) > 0.01 THEN
    v_equity := v_equity || jsonb_build_array(jsonb_build_object(
      'code', '3999', 'name', 'Current Earnings', 'balance', v_current_earnings));
    v_total_equity := ROUND(v_total_equity + v_current_earnings, 2);
  END IF;
  RETURN jsonb_build_object(
    'as_of', COALESCE(p_as_of, CURRENT_DATE), 'assets', v_assets,
    'liabilities', v_liabilities, 'equity', v_equity,
    'total_assets', v_total_assets, 'total_liabilities', v_total_liabilities,
    'total_equity', v_total_equity, 'current_earnings', v_current_earnings,
    'balanced', ABS(v_total_assets - (v_total_liabilities + v_total_equity)) <= 0.01
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_ledger_cash_flow(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_business TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_cash_account_ids UUID[];
  v_inflows JSONB;
  v_outflows JSONB;
  v_total_inflows NUMERIC(12,2);
  v_total_outflows NUMERIC(12,2);
  v_business TEXT := accounting_effective_business(p_business);
BEGIN
  SELECT ARRAY_AGG(id) INTO v_cash_account_ids
  FROM chart_of_accounts
  WHERE system_key IN ('cash', 'bank', 'mpesa', 'mpesa_goalhub') AND active = TRUE;

  WITH cash_lines AS (
    SELECT e.source_type,
      CASE
        WHEN e.source_type = 'payment_received' THEN 'Customer payments'
        WHEN e.source_type = 'payment_made' THEN 'Supplier payments'
        WHEN e.source_type = 'expense' THEN 'Expenses paid'
        WHEN e.source_type = 'external' THEN 'External cash receipts'
        WHEN e.source_type = 'reversal' THEN 'Reversals'
        WHEN e.source_type = 'manual_adjustment' THEN 'Manual adjustments'
        ELSE initcap(replace(e.source_type, '_', ' '))
      END AS label,
      SUM(l.debit) AS debit, SUM(l.credit) AS credit
    FROM ledger_journal_lines l
    JOIN ledger_journal_entries e ON e.id = l.journal_entry_id
    WHERE e.status IN ('posted', 'reversed')
      AND l.account_id = ANY(COALESCE(v_cash_account_ids, ARRAY[]::UUID[]))
      AND (p_from IS NULL OR e.entry_date >= p_from)
      AND (p_to IS NULL OR e.entry_date <= p_to)
      AND (v_business IS NULL OR e.business = v_business)
    GROUP BY e.source_type
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('source_type', source_type, 'label', label, 'amount', debit) ORDER BY label)
      FILTER (WHERE debit > 0), '[]'::jsonb),
    COALESCE(jsonb_agg(jsonb_build_object('source_type', source_type, 'label', label, 'amount', credit) ORDER BY label)
      FILTER (WHERE credit > 0), '[]'::jsonb),
    COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO v_inflows, v_outflows, v_total_inflows, v_total_outflows FROM cash_lines;

  RETURN jsonb_build_object(
    'from', p_from, 'to', p_to, 'inflows', v_inflows, 'outflows', v_outflows,
    'total_inflows', v_total_inflows, 'total_outflows', v_total_outflows,
    'net_cash_flow', v_total_inflows - v_total_outflows
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_ledger_profit_and_loss(DATE, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_ledger_balance_sheet(DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_ledger_cash_flow(DATE, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_ledger_profit_and_loss(DATE, DATE, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_ledger_balance_sheet(DATE, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_ledger_cash_flow(DATE, DATE, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION get_ledger_account_balances(p_business TEXT DEFAULT NULL)
RETURNS TABLE (
  account_id UUID, code TEXT, name TEXT, account_type TEXT, normal_balance TEXT,
  total_debit NUMERIC, total_credit NUMERIC, balance NUMERIC
) AS $$
DECLARE
  v_business TEXT := accounting_effective_business(p_business);
BEGIN
  RETURN QUERY
  SELECT coa.id, coa.code, coa.name, coa.account_type::TEXT, coa.normal_balance::TEXT,
    COALESCE(SUM(l.debit) FILTER (WHERE e.id IS NOT NULL), 0),
    COALESCE(SUM(l.credit) FILTER (WHERE e.id IS NOT NULL), 0),
    CASE WHEN coa.normal_balance = 'debit'
      THEN COALESCE(SUM(l.debit) FILTER (WHERE e.id IS NOT NULL), 0)
        - COALESCE(SUM(l.credit) FILTER (WHERE e.id IS NOT NULL), 0)
      ELSE COALESCE(SUM(l.credit) FILTER (WHERE e.id IS NOT NULL), 0)
        - COALESCE(SUM(l.debit) FILTER (WHERE e.id IS NOT NULL), 0)
    END
  FROM chart_of_accounts coa
  LEFT JOIN ledger_journal_lines l ON l.account_id = coa.id
  LEFT JOIN ledger_journal_entries e ON e.id = l.journal_entry_id
    AND e.status IN ('posted', 'reversed')
    AND (v_business IS NULL OR e.business = v_business)
  WHERE coa.active = TRUE
  GROUP BY coa.id, coa.code, coa.name, coa.account_type, coa.normal_balance;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_ledger_account_balances(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_ledger_account_balances(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION get_vat_summary(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_business TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_invoice_vat NUMERIC(12,2);
  v_credit_vat NUMERIC(12,2);
  v_output_vat NUMERIC(12,2);
  v_input_vat NUMERIC(12,2);
  v_business TEXT := accounting_effective_business(p_business);
BEGIN
  SELECT COALESCE(SUM(COALESCE(vat_amount, 0)), 0) INTO v_invoice_vat
  FROM invoices
  WHERE status::TEXT IN ('sent', 'pending', 'partial', 'partially_paid', 'paid', 'overdue')
    AND posted_journal_entry_id IS NOT NULL
    AND (p_from IS NULL OR COALESCE(issued_at::DATE, created_at::DATE) >= p_from)
    AND (p_to IS NULL OR COALESCE(issued_at::DATE, created_at::DATE) <= p_to)
    AND (v_business IS NULL OR business = v_business);

  SELECT COALESCE(SUM(COALESCE(cn.tax_total, 0)), 0) INTO v_credit_vat
  FROM credit_notes cn
  WHERE cn.status::TEXT IN ('open', 'applied')
    AND cn.posted_journal_entry_id IS NOT NULL
    AND (p_from IS NULL OR cn.issue_date >= p_from)
    AND (p_to IS NULL OR cn.issue_date <= p_to)
    AND (v_business IS NULL OR cn.business = v_business);

  SELECT COALESCE(SUM(COALESCE(tax_total, 0)), 0) INTO v_input_vat
  FROM bills
  WHERE status IN ('open', 'partially_paid', 'paid', 'overdue')
    AND posted_journal_entry_id IS NOT NULL
    AND (p_from IS NULL OR issue_date >= p_from)
    AND (p_to IS NULL OR issue_date <= p_to)
    AND (v_business IS NULL OR business = v_business);

  v_output_vat := ROUND(v_invoice_vat - v_credit_vat, 2);
  RETURN jsonb_build_object(
    'from', p_from, 'to', p_to, 'output_vat', v_output_vat,
    'input_vat', v_input_vat, 'net_vat_payable', v_output_vat - v_input_vat
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_vat_summary(DATE, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_vat_summary(DATE, DATE, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION get_accounting_sales_by_item(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_business TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_business TEXT := accounting_effective_business(p_business);
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(grouped) ORDER BY grouped.total DESC, grouped.name), '[]'::jsonb)
    FROM (
      SELECT COALESCE(NULLIF(il.description_snapshot, ''), 'Item') AS name,
        SUM(il.quantity) AS quantity, ROUND(SUM(il.line_total), 2) AS total
      FROM invoice_lines il
      JOIN invoices i ON i.id = il.invoice_id
      WHERE i.posted_journal_entry_id IS NOT NULL
        AND i.status::TEXT NOT IN ('draft', 'cancelled')
        AND (p_from IS NULL OR COALESCE(i.issued_at::DATE, i.created_at::DATE) >= p_from)
        AND (p_to IS NULL OR COALESCE(i.issued_at::DATE, i.created_at::DATE) <= p_to)
        AND (v_business IS NULL OR i.business = v_business)
      GROUP BY COALESCE(NULLIF(il.description_snapshot, ''), 'Item')
    ) grouped
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_accounting_sales_by_item(DATE, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_accounting_sales_by_item(DATE, DATE, TEXT) TO authenticated, service_role;

-- Receipt documents are accounting evidence: scope them to a business and void
-- mistakes instead of deleting the source record.
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS business TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

UPDATE receipts SET business = 'expresswash' WHERE business IS NULL;
ALTER TABLE receipts ALTER COLUMN business SET DEFAULT 'expresswash';
ALTER TABLE receipts ALTER COLUMN business SET NOT NULL;
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_business_fkey;
ALTER TABLE receipts ADD CONSTRAINT receipts_business_fkey
  FOREIGN KEY (business) REFERENCES businesses(slug) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_status_check;
ALTER TABLE receipts ADD CONSTRAINT receipts_status_check CHECK (status IN ('active', 'void'));
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_amount_check;
ALTER TABLE receipts ADD CONSTRAINT receipts_amount_check CHECK (amount > 0) NOT VALID;

DROP POLICY IF EXISTS "admins_manage_receipts" ON receipts;
DROP POLICY IF EXISTS "receipts_business_access" ON receipts;
CREATE POLICY "receipts_business_access" ON receipts
  FOR ALL TO authenticated
  USING (accounting_can_see_business(business))
  WITH CHECK (accounting_can_see_business(business));

CREATE INDEX IF NOT EXISTS idx_receipts_business_date ON receipts(business, date DESC);

CREATE OR REPLACE FUNCTION void_receipt(p_receipt_id UUID, p_reason TEXT)
RETURNS JSONB AS $$
DECLARE
  v_receipt receipts%ROWTYPE;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can void receipts' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A void reason is required';
  END IF;

  SELECT * INTO v_receipt FROM receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND OR NOT accounting_can_see_business(v_receipt.business) THEN
    RAISE EXCEPTION 'Receipt not found or not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_receipt.status = 'void' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'receipt_id', p_receipt_id);
  END IF;

  UPDATE receipts
  SET status = 'void', voided_at = NOW(), voided_by = auth.uid(), void_reason = TRIM(p_reason)
  WHERE id = p_receipt_id;
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'receipt_id', p_receipt_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION void_receipt(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION void_receipt(UUID, TEXT) TO authenticated, service_role;

-- Posting is restricted to approved expenses in the caller's business.
CREATE OR REPLACE FUNCTION post_expense_to_ledger(p_expense_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_expense expenses%ROWTYPE;
  v_entry_id UUID;
  v_expense_account UUID;
  v_cash_account UUID;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can post expenses' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_expense FROM expenses WHERE id = p_expense_id FOR UPDATE;
  IF NOT FOUND OR NOT accounting_can_see_business(v_expense.business) THEN
    RAISE EXCEPTION 'Expense not found or not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_expense.posted_journal_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'journal_entry_id', v_expense.posted_journal_entry_id);
  END IF;
  IF v_expense.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved expenses can be posted';
  END IF;

  v_expense_account := CASE v_expense.category
    WHEN 'supplies' THEN accounting_system_account_id('cleaning_supplies')
    WHEN 'salary' THEN accounting_system_account_id('staff_costs')
    WHEN 'rent' THEN accounting_system_account_id('rent')
    WHEN 'fuel' THEN accounting_system_account_id('transport')
    WHEN 'utilities' THEN accounting_system_account_id('utilities')
    ELSE accounting_system_account_id('other_expenses')
  END;
  v_cash_account := accounting_cash_account_id(v_expense.payment_method);

  v_entry_id := post_journal_entry(
    'expense', p_expense_id, COALESCE(v_expense.expense_date, CURRENT_DATE),
    'Expense posted: ' || v_expense.description,
    jsonb_build_array(
      jsonb_build_object('account_id', v_expense_account, 'debit', ROUND(v_expense.amount, 2), 'description', v_expense.description),
      jsonb_build_object('account_id', v_cash_account, 'credit', ROUND(v_expense.amount, 2), 'description', 'Cash paid for expense')
    ),
    v_expense.business
  );

  UPDATE expenses SET posted_journal_entry_id = v_entry_id WHERE id = p_expense_id;
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'journal_entry_id', v_entry_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION post_expense_to_ledger(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION post_expense_to_ledger(UUID) TO authenticated, service_role;

-- post_journal_entry is the common write boundary for every native accounting
-- workflow. Enforce business access there as defence in depth for all current
-- and future SECURITY DEFINER callers.
CREATE OR REPLACE FUNCTION post_journal_entry(
  p_source_type TEXT,
  p_source_id UUID,
  p_entry_date DATE,
  p_memo TEXT,
  p_lines JSONB,
  p_business TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_entry_id UUID;
  v_entry_number TEXT;
  v_line JSONB;
  v_account_id UUID;
  v_debit NUMERIC(12,2);
  v_credit NUMERIC(12,2);
  v_total_debit NUMERIC(12,2) := 0;
  v_total_credit NUMERIC(12,2) := 0;
  v_business TEXT;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can post journal entries' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF COALESCE(jsonb_typeof(p_lines), '') <> 'array' OR COALESCE(jsonb_array_length(p_lines), 0) < 2 THEN
    RAISE EXCEPTION 'Journal entry requires at least two lines';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_account_id := (v_line->>'account_id')::UUID;
    v_debit := COALESCE((v_line->>'debit')::NUMERIC, 0);
    v_credit := COALESCE((v_line->>'credit')::NUMERIC, 0);
    IF v_account_id IS NULL OR NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE id = v_account_id AND active = TRUE) THEN
      RAISE EXCEPTION 'Invalid or inactive account_id %', v_account_id;
    END IF;
    IF v_debit < 0 OR v_credit < 0 OR (v_debit > 0 AND v_credit > 0) OR (v_debit = 0 AND v_credit = 0) THEN
      RAISE EXCEPTION 'Each journal line must contain one positive debit or credit';
    END IF;
    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
  END LOOP;

  IF v_total_debit <= 0 OR ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry must balance: debit %, credit %', v_total_debit, v_total_credit;
  END IF;

  v_business := COALESCE(accounting_resolve_business(p_business), accounting_source_business(p_source_type, p_source_id));
  IF v_business IS NULL THEN
    RAISE EXCEPTION 'Journal entry business could not be resolved';
  END IF;
  IF NOT accounting_can_see_business(v_business) THEN
    RAISE EXCEPTION 'Not authorized for business %', v_business USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_entry_number := 'JE-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));
  INSERT INTO ledger_journal_entries (
    entry_number, source_type, source_id, entry_date, memo, status, business, created_by, posted_at
  ) VALUES (
    v_entry_number, p_source_type, p_source_id, COALESCE(p_entry_date, CURRENT_DATE), p_memo,
    'posted', v_business, auth.uid(), NOW()
  ) RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO ledger_journal_lines (
      journal_entry_id, account_id, debit, credit, contact_id, tax_rate_id, description, metadata
    ) VALUES (
      v_entry_id, (v_line->>'account_id')::UUID,
      COALESCE((v_line->>'debit')::NUMERIC, 0), COALESCE((v_line->>'credit')::NUMERIC, 0),
      NULLIF(v_line->>'contact_id', '')::UUID, NULLIF(v_line->>'tax_rate_id', '')::UUID,
      v_line->>'description', COALESCE(v_line->'metadata', '{}'::jsonb)
    );
  END LOOP;

  PERFORM assert_ledger_entry_balanced(v_entry_id);
  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION post_journal_entry(TEXT, UUID, DATE, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION post_journal_entry(TEXT, UUID, DATE, TEXT, JSONB, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION get_customer_payment_allocation_options(p_payment_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_allocated_amount NUMERIC(12,2);
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can view payment allocation options' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
  IF NOT FOUND OR NOT accounting_can_see_business(v_payment.business) THEN
    RAISE EXCEPTION 'Payment not found or not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT ROUND(COALESCE(SUM(amount_allocated), 0), 2) INTO v_allocated_amount
  FROM payment_allocations WHERE payment_id = p_payment_id;

  RETURN jsonb_build_object(
    'payment', jsonb_build_object(
      'id', v_payment.id, 'amount', ROUND(COALESCE(v_payment.amount, 0), 2),
      'allocated_amount', COALESCE(v_allocated_amount, 0),
      'unapplied_amount', ROUND(GREATEST(COALESCE(v_payment.amount, 0) - COALESCE(v_allocated_amount, 0), 0), 2),
      'customer_id', v_payment.customer_id, 'customer_name', v_payment.customer_name,
      'status', v_payment.status, 'posted_journal_entry_id', v_payment.posted_journal_entry_id
    ),
    'allocations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'invoice_id', pa.invoice_id, 'invoice_number', i.invoice_number,
        'customer_name', i.customer_name, 'amount_allocated', pa.amount_allocated,
        'invoice_balance', COALESCE(i.balance, GREATEST(COALESCE(i.total, 0) - COALESCE(i.paid_amount, 0), 0)),
        'allocated_at', pa.allocated_at
      ) ORDER BY i.invoice_number)
      FROM payment_allocations pa JOIN invoices i ON i.id = pa.invoice_id
      WHERE pa.payment_id = p_payment_id
    ), '[]'::jsonb),
    'open_invoices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'invoice_id', i.id, 'invoice_number', i.invoice_number, 'customer_name', i.customer_name,
        'total', i.total, 'paid_amount', i.paid_amount,
        'balance', COALESCE(i.balance, GREATEST(COALESCE(i.total, 0) - COALESCE(i.paid_amount, 0), 0)),
        'current_payment_allocation', COALESCE(pa.current_amount, 0),
        'due_date', COALESCE(NULLIF(i.due_date, ''), i.due_at::DATE::TEXT), 'status', i.status
      ) ORDER BY COALESCE(NULLIF(i.due_date, '')::DATE, i.due_at::DATE, CURRENT_DATE), i.invoice_number)
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(amount_allocated) AS current_amount
        FROM payment_allocations WHERE payment_id = p_payment_id GROUP BY invoice_id
      ) pa ON pa.invoice_id = i.id
      WHERE i.business = v_payment.business
        AND i.status::TEXT NOT IN ('draft', 'cancelled', 'paid')
        AND COALESCE(i.balance, GREATEST(COALESCE(i.total, 0) - COALESCE(i.paid_amount, 0), 0)) + COALESCE(pa.current_amount, 0) > 0
        AND (
          i.customer_id IS NOT DISTINCT FROM v_payment.customer_id
          OR lower(COALESCE(i.customer_name, '')) = lower(COALESCE(v_payment.customer_name, ''))
        )
    ), '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_customer_payment_allocation_options(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_customer_payment_allocation_options(UUID) TO authenticated, service_role;

-- Monetary line invariants apply even when a caller bypasses the UI/RPC. NOT
-- VALID avoids blocking rollout on legacy rows while still enforcing all new
-- inserts and updates; legacy exceptions can be remediated then validated.
ALTER TABLE invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_amount_integrity;
ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_amount_integrity CHECK (
  quantity > 0 AND unit_price >= 0 AND discount_amount >= 0
  AND discount_amount <= quantity * unit_price AND tax_amount >= 0
  AND ABS(line_total - (ROUND(quantity * unit_price - discount_amount, 2) + tax_amount)) <= 0.01
) NOT VALID;

ALTER TABLE bill_lines DROP CONSTRAINT IF EXISTS bill_lines_amount_integrity;
ALTER TABLE bill_lines ADD CONSTRAINT bill_lines_amount_integrity CHECK (
  quantity > 0 AND unit_price >= 0 AND discount_amount >= 0
  AND discount_amount <= quantity * unit_price AND tax_amount >= 0
  AND ABS(line_total - (ROUND(quantity * unit_price - discount_amount, 2) + tax_amount)) <= 0.01
) NOT VALID;

-- Refunds are accounting documents too: persist their business explicitly so
-- reads and RLS cannot leak a refund from one business into another.
ALTER TABLE customer_refunds ADD COLUMN IF NOT EXISTS business TEXT;
UPDATE customer_refunds r
SET business = COALESCE(
  (SELECT i.business FROM invoices i WHERE i.id = r.invoice_id),
  (SELECT p.business FROM payments p WHERE p.id = r.payment_id),
  'expresswash'
)
WHERE r.business IS NULL;
ALTER TABLE customer_refunds ALTER COLUMN business SET DEFAULT 'expresswash';
ALTER TABLE customer_refunds ALTER COLUMN business SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_refunds_business_created
  ON customer_refunds(business, created_at DESC);

DROP POLICY IF EXISTS "customer_refunds_admin_all" ON customer_refunds;
DROP POLICY IF EXISTS "customer_refunds_business_admin_all" ON customer_refunds;
CREATE POLICY "customer_refunds_business_admin_all" ON customer_refunds
  FOR ALL TO authenticated
  USING (accounting_can_see_business(business))
  WITH CHECK (accounting_can_see_business(business));

-- A cash refund must be tied to the actual paid source, stay within the
-- remaining refundable amount, and remain inside one authorised business.
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
  v_business TEXT;
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

  v_entry_id := post_journal_entry(
    'manual_adjustment', v_refund_id, CURRENT_DATE, 'Customer refund: ' || v_refund_number,
    jsonb_build_array(
      jsonb_build_object('account_id', v_ar_account, 'debit', ROUND(p_amount, 2), 'contact_id', v_contact_id, 'description', 'Restore receivable/customer credit for refund'),
      jsonb_build_object('account_id', v_cash_account, 'credit', ROUND(p_amount, 2), 'contact_id', v_contact_id, 'description', 'Cash refunded to customer')
    ), v_business
  );
  UPDATE customer_refunds SET posted_journal_entry_id = v_entry_id WHERE id = v_refund_id;
  RETURN jsonb_build_object('success', true, 'refund_id', v_refund_id, 'refund_number', v_refund_number, 'journal_entry_id', v_entry_id);
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION record_customer_refund(UUID, UUID, NUMERIC, payment_method, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_customer_refund(UUID, UUID, NUMERIC, payment_method, TEXT, TEXT) TO authenticated, service_role;

-- Scope unapplied customer cash to the selected business. The backend applies
-- the same RBAC rules as every other accounting report.
DROP FUNCTION IF EXISTS list_customer_credit_balances();
CREATE OR REPLACE FUNCTION list_customer_credit_balances(p_business TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_business TEXT := accounting_effective_business(p_business);
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'payment_id', p.id,
      'customer_id', p.customer_id,
      'customer_name', p.customer_name,
      'amount', p.amount,
      'allocated_amount', ROUND(COALESCE(allocated.total_allocated, 0), 2),
      'unapplied_amount', ROUND(GREATEST(COALESCE(p.amount, 0) - COALESCE(allocated.total_allocated, 0), 0), 2),
      'method', p.method,
      'provider', p.provider,
      'provider_reference', p.provider_reference,
      'created_at', p.created_at,
      'posted_journal_entry_id', p.posted_journal_entry_id
    ) ORDER BY p.created_at DESC)
    FROM payments p
    LEFT JOIN (
      SELECT payment_id, SUM(amount_allocated) AS total_allocated
      FROM payment_allocations
      GROUP BY payment_id
    ) allocated ON allocated.payment_id = p.id
    WHERE p.status::TEXT = 'completed'
      AND (v_business IS NULL OR p.business = v_business)
      AND ROUND(GREATEST(COALESCE(p.amount, 0) - COALESCE(allocated.total_allocated, 0), 0), 2) > 0
  ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION list_customer_credit_balances(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_customer_credit_balances(TEXT) TO authenticated, service_role;

-- Aging represents ledger-backed obligations, not drafts that have not yet
-- entered the books.
CREATE OR REPLACE FUNCTION get_receivables_aging(
  p_as_of DATE DEFAULT CURRENT_DATE,
  p_business TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_business TEXT := accounting_effective_business(p_business);
BEGIN
  RETURN (
    WITH open_invoices AS (
      SELECT id, invoice_number, customer_name,
        COALESCE(NULLIF(due_date, '')::DATE, due_at::DATE, CURRENT_DATE) AS due_on,
        COALESCE(balance, total - COALESCE(paid_amount, 0), total) AS balance_due
      FROM invoices
      WHERE posted_journal_entry_id IS NOT NULL
        AND status::TEXT NOT IN ('paid', 'void', 'cancelled')
        AND COALESCE(balance, total - COALESCE(paid_amount, 0), total) > 0
        AND (v_business IS NULL OR business = v_business)
    )
    SELECT jsonb_build_object(
      'as_of', COALESCE(p_as_of, CURRENT_DATE),
      'current', COALESCE(SUM(balance_due) FILTER (WHERE due_on >= COALESCE(p_as_of, CURRENT_DATE)), 0),
      'days_1_30', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on BETWEEN 1 AND 30), 0),
      'days_31_60', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on BETWEEN 31 AND 60), 0),
      'days_61_90', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on BETWEEN 61 AND 90), 0),
      'days_90_plus', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on > 90), 0),
      'items', COALESCE(jsonb_agg(jsonb_build_object(
        'invoice_id', id, 'invoice_number', invoice_number, 'customer_name', customer_name,
        'due_date', due_on, 'balance_due', balance_due,
        'days_overdue', GREATEST(COALESCE(p_as_of, CURRENT_DATE) - due_on, 0)
      ) ORDER BY due_on), '[]'::jsonb)
    ) FROM open_invoices
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_payables_aging(
  p_as_of DATE DEFAULT CURRENT_DATE,
  p_business TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_business TEXT := accounting_effective_business(p_business);
BEGIN
  RETURN (
    WITH open_bills AS (
      SELECT b.id, b.bill_number, c.name AS supplier_name,
        COALESCE(b.due_date, CURRENT_DATE) AS due_on, b.balance_due
      FROM bills b
      LEFT JOIN contacts c ON c.id = b.supplier_contact_id
      WHERE b.posted_journal_entry_id IS NOT NULL
        AND b.status NOT IN ('paid', 'void')
        AND b.balance_due > 0
        AND (v_business IS NULL OR b.business = v_business)
    )
    SELECT jsonb_build_object(
      'as_of', COALESCE(p_as_of, CURRENT_DATE),
      'current', COALESCE(SUM(balance_due) FILTER (WHERE due_on >= COALESCE(p_as_of, CURRENT_DATE)), 0),
      'days_1_30', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on BETWEEN 1 AND 30), 0),
      'days_31_60', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on BETWEEN 31 AND 60), 0),
      'days_61_90', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on BETWEEN 61 AND 90), 0),
      'days_90_plus', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on > 90), 0),
      'items', COALESCE(jsonb_agg(jsonb_build_object(
        'bill_id', id, 'bill_number', bill_number, 'supplier_name', supplier_name,
        'due_date', due_on, 'balance_due', balance_due,
        'days_overdue', GREATEST(COALESCE(p_as_of, CURRENT_DATE) - due_on, 0)
      ) ORDER BY due_on), '[]'::jsonb)
    ) FROM open_bills
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_receivables_aging(DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_payables_aging(DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_receivables_aging(DATE, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_payables_aging(DATE, TEXT) TO authenticated, service_role;
