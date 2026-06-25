-- Migration: Include current earnings in balance sheet equity
--
-- The ledger is balanced across all account types, but balance-sheet reports
-- only display assets, liabilities, and equity. Until income/expense accounts
-- are closed to retained earnings, the report must include current earnings as
-- an equity component for point-in-time snapshots.

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
  v_current_earnings NUMERIC(12,2);
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

  SELECT ROUND(
    COALESCE(SUM(
      CASE
        WHEN coa.account_type = 'income' THEN l.credit - l.debit
        WHEN coa.account_type = 'expense' THEN l.credit - l.debit
        ELSE 0
      END
    ), 0),
    2
  )
  INTO v_current_earnings
  FROM chart_of_accounts coa
  JOIN ledger_journal_lines l ON l.account_id = coa.id
  JOIN ledger_journal_entries e ON e.id = l.journal_entry_id
  WHERE e.status = 'posted'
    AND e.entry_date <= COALESCE(p_as_of, CURRENT_DATE)
    AND coa.account_type IN ('income', 'expense')
    AND coa.active = TRUE;

  IF ABS(v_current_earnings) > 0.01 THEN
    v_equity := v_equity || jsonb_build_array(jsonb_build_object(
      'code', '3999',
      'name', 'Current Earnings',
      'balance', v_current_earnings
    ));
    v_total_equity := ROUND(v_total_equity + v_current_earnings, 2);
  END IF;

  RETURN jsonb_build_object(
    'as_of', COALESCE(p_as_of, CURRENT_DATE),
    'assets', v_assets,
    'liabilities', v_liabilities,
    'equity', v_equity,
    'total_assets', v_total_assets,
    'total_liabilities', v_total_liabilities,
    'total_equity', v_total_equity,
    'current_earnings', v_current_earnings,
    'balanced', ABS(v_total_assets - (v_total_liabilities + v_total_equity)) <= 0.01
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
