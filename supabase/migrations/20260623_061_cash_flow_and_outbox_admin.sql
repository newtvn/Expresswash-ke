-- ============================================================
-- Cash flow report and admin outbox support
-- ============================================================

CREATE OR REPLACE FUNCTION get_ledger_cash_flow(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_cash_account_ids UUID[];
  v_inflows JSONB;
  v_outflows JSONB;
  v_total_inflows NUMERIC(12,2);
  v_total_outflows NUMERIC(12,2);
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can view cash flow reports';
  END IF;

  SELECT ARRAY_AGG(id)
  INTO v_cash_account_ids
  FROM chart_of_accounts
  WHERE system_key IN ('cash', 'bank', 'mpesa')
    AND active = TRUE;

  WITH cash_lines AS (
    SELECT
      e.source_type,
      CASE
        WHEN e.source_type = 'payment_received' THEN 'Customer payments'
        WHEN e.source_type = 'payment_made' THEN 'Supplier payments'
        WHEN e.source_type = 'expense' THEN 'Expenses paid'
        WHEN e.source_type = 'manual_adjustment' THEN 'Manual adjustments'
        ELSE initcap(replace(e.source_type, '_', ' '))
      END AS label,
      SUM(l.debit) AS debit,
      SUM(l.credit) AS credit
    FROM ledger_journal_lines l
    JOIN ledger_journal_entries e ON e.id = l.journal_entry_id
    WHERE e.status = 'posted'
      AND l.account_id = ANY(COALESCE(v_cash_account_ids, ARRAY[]::UUID[]))
      AND (p_from IS NULL OR e.entry_date >= p_from)
      AND (p_to IS NULL OR e.entry_date <= p_to)
    GROUP BY e.source_type
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('source_type', source_type, 'label', label, 'amount', debit) ORDER BY label)
      FILTER (WHERE debit > 0), '[]'::jsonb),
    COALESCE(jsonb_agg(jsonb_build_object('source_type', source_type, 'label', label, 'amount', credit) ORDER BY label)
      FILTER (WHERE credit > 0), '[]'::jsonb),
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO v_inflows, v_outflows, v_total_inflows, v_total_outflows
  FROM cash_lines;

  RETURN jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'inflows', v_inflows,
    'outflows', v_outflows,
    'total_inflows', COALESCE(v_total_inflows, 0),
    'total_outflows', COALESCE(v_total_outflows, 0),
    'net_cash_flow', COALESCE(v_total_inflows, 0) - COALESCE(v_total_outflows, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_ledger_cash_flow(DATE, DATE) TO authenticated;
