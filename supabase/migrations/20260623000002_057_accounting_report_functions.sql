-- ============================================================
-- Accounting report functions
--
-- Report RPCs read canonical ledger/source facts. They are additive
-- and do not replace the existing dashboard/report functions yet.
-- ============================================================

CREATE OR REPLACE FUNCTION get_ledger_profit_and_loss(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_income JSONB;
  v_expenses JSONB;
  v_total_income NUMERIC(12,2);
  v_total_expenses NUMERIC(12,2);
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can view ledger reports';
  END IF;

  WITH account_totals AS (
    SELECT
      coa.id,
      coa.code,
      coa.name,
      coa.account_type,
      COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0) AS income_amount,
      COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS expense_amount
    FROM chart_of_accounts coa
    JOIN ledger_journal_lines l ON l.account_id = coa.id
    JOIN ledger_journal_entries e ON e.id = l.journal_entry_id
    WHERE e.status = 'posted'
      AND coa.account_type IN ('income', 'expense')
      AND (p_from IS NULL OR e.entry_date >= p_from)
      AND (p_to IS NULL OR e.entry_date <= p_to)
    GROUP BY coa.id, coa.code, coa.name, coa.account_type
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object('code', code, 'name', name, 'amount', income_amount)
      ORDER BY code
    ) FILTER (WHERE account_type = 'income'), '[]'::jsonb),
    COALESCE(jsonb_agg(
      jsonb_build_object('code', code, 'name', name, 'amount', expense_amount)
      ORDER BY code
    ) FILTER (WHERE account_type = 'expense'), '[]'::jsonb),
    COALESCE(SUM(income_amount) FILTER (WHERE account_type = 'income'), 0),
    COALESCE(SUM(expense_amount) FILTER (WHERE account_type = 'expense'), 0)
  INTO v_income, v_expenses, v_total_income, v_total_expenses
  FROM account_totals;

  RETURN jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'income', v_income,
    'expenses', v_expenses,
    'total_income', v_total_income,
    'total_expenses', v_total_expenses,
    'net_profit', v_total_income - v_total_expenses
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_ledger_balance_sheet(
  p_as_of DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_assets JSONB;
  v_liabilities JSONB;
  v_equity JSONB;
  v_total_assets NUMERIC(12,2);
  v_total_liabilities NUMERIC(12,2);
  v_total_equity NUMERIC(12,2);
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can view ledger reports';
  END IF;

  WITH account_totals AS (
    SELECT
      coa.id,
      coa.code,
      coa.name,
      coa.account_type,
      coa.normal_balance,
      CASE
        WHEN coa.normal_balance = 'debit'
          THEN COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.debit ELSE 0 END), 0)
            - COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.credit ELSE 0 END), 0)
        ELSE COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.credit ELSE 0 END), 0)
            - COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.debit ELSE 0 END), 0)
      END AS balance
    FROM chart_of_accounts coa
    LEFT JOIN ledger_journal_lines l ON l.account_id = coa.id
    LEFT JOIN ledger_journal_entries e ON e.id = l.journal_entry_id
      AND e.status = 'posted'
      AND e.entry_date <= COALESCE(p_as_of, CURRENT_DATE)
    WHERE coa.account_type IN ('asset', 'liability', 'equity')
      AND coa.active = TRUE
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

  RETURN jsonb_build_object(
    'as_of', COALESCE(p_as_of, CURRENT_DATE),
    'assets', v_assets,
    'liabilities', v_liabilities,
    'equity', v_equity,
    'total_assets', v_total_assets,
    'total_liabilities', v_total_liabilities,
    'total_equity', v_total_equity,
    'balanced', ABS(v_total_assets - (v_total_liabilities + v_total_equity)) <= 0.01
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_vat_summary(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_output_vat NUMERIC(12,2);
  v_input_vat NUMERIC(12,2);
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can view VAT reports';
  END IF;

  SELECT COALESCE(SUM(COALESCE(vat_amount, 0)), 0)
  INTO v_output_vat
  FROM invoices
  WHERE status::TEXT IN ('issued', 'sent', 'partial', 'partially_paid', 'paid', 'overdue')
    AND (p_from IS NULL OR COALESCE(issued_at::DATE, created_at::DATE) >= p_from)
    AND (p_to IS NULL OR COALESCE(issued_at::DATE, created_at::DATE) <= p_to);

  SELECT COALESCE(SUM(tax_total), 0)
  INTO v_input_vat
  FROM bills
  WHERE status IN ('open', 'partially_paid', 'paid', 'overdue')
    AND (p_from IS NULL OR issue_date >= p_from)
    AND (p_to IS NULL OR issue_date <= p_to);

  RETURN jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'output_vat', v_output_vat,
    'input_vat', v_input_vat,
    'net_vat_payable', v_output_vat - v_input_vat
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_receivables_aging(
  p_as_of DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can view receivables reports';
  END IF;

  RETURN (
    WITH open_invoices AS (
      SELECT
        id,
        invoice_number,
        customer_name,
        COALESCE(NULLIF(due_date, '')::DATE, due_at::DATE, CURRENT_DATE) AS due_on,
        COALESCE(balance, total - COALESCE(paid_amount, 0), total) AS balance_due
      FROM invoices
      WHERE status::TEXT NOT IN ('paid', 'void', 'cancelled')
        AND COALESCE(balance, total - COALESCE(paid_amount, 0), total) > 0
    )
    SELECT jsonb_build_object(
      'as_of', COALESCE(p_as_of, CURRENT_DATE),
      'current', COALESCE(SUM(balance_due) FILTER (WHERE due_on >= COALESCE(p_as_of, CURRENT_DATE)), 0),
      'days_1_30', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on BETWEEN 1 AND 30), 0),
      'days_31_60', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on BETWEEN 31 AND 60), 0),
      'days_61_90', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on BETWEEN 61 AND 90), 0),
      'days_90_plus', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on > 90), 0),
      'items', COALESCE(jsonb_agg(jsonb_build_object(
        'invoice_id', id,
        'invoice_number', invoice_number,
        'customer_name', customer_name,
        'due_date', due_on,
        'balance_due', balance_due,
        'days_overdue', GREATEST(COALESCE(p_as_of, CURRENT_DATE) - due_on, 0)
      ) ORDER BY due_on), '[]'::jsonb)
    )
    FROM open_invoices
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_payables_aging(
  p_as_of DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can view payables reports';
  END IF;

  RETURN (
    WITH open_bills AS (
      SELECT
        b.id,
        b.bill_number,
        c.name AS supplier_name,
        COALESCE(b.due_date, CURRENT_DATE) AS due_on,
        b.balance_due
      FROM bills b
      LEFT JOIN contacts c ON c.id = b.supplier_contact_id
      WHERE b.status NOT IN ('paid', 'void')
        AND b.balance_due > 0
    )
    SELECT jsonb_build_object(
      'as_of', COALESCE(p_as_of, CURRENT_DATE),
      'current', COALESCE(SUM(balance_due) FILTER (WHERE due_on >= COALESCE(p_as_of, CURRENT_DATE)), 0),
      'days_1_30', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on BETWEEN 1 AND 30), 0),
      'days_31_60', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on BETWEEN 31 AND 60), 0),
      'days_61_90', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on BETWEEN 61 AND 90), 0),
      'days_90_plus', COALESCE(SUM(balance_due) FILTER (WHERE COALESCE(p_as_of, CURRENT_DATE) - due_on > 90), 0),
      'items', COALESCE(jsonb_agg(jsonb_build_object(
        'bill_id', id,
        'bill_number', bill_number,
        'supplier_name', supplier_name,
        'due_date', due_on,
        'balance_due', balance_due,
        'days_overdue', GREATEST(COALESCE(p_as_of, CURRENT_DATE) - due_on, 0)
      ) ORDER BY due_on), '[]'::jsonb)
    )
    FROM open_bills
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_ledger_profit_and_loss(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ledger_balance_sheet(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_vat_summary(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_receivables_aging(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_payables_aging(DATE) TO authenticated;
