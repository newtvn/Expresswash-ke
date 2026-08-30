-- B1: business-aware ledger posting. Native journal entries inherit their
-- source document's business, so the ledger stays partitioned without editing
-- the six native posting RPCs — they already call post_journal_entry with
-- (source_type, source_id), which is enough to derive the business centrally.

-- Map a posted entry's source back to its business slug.
-- reversal: source_id is the original entry, so reuse its business.
-- manual_adjustment (refunds/credit reallocation) is polymorphic -> left NULL
-- here and tagged explicitly when B3 threads business through those RPCs.
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
    ELSE v := NULL;
  END CASE;
  RETURN v;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION accounting_source_business(TEXT, UUID) TO authenticated, service_role;

-- Redefine post_journal_entry with an optional p_business. The 5-arg version
-- is dropped so existing 5-arg callers bind to this one (p_business defaults
-- NULL -> business derived from the source document). Explicit p_business wins
-- and is validated against the registry.
DROP FUNCTION IF EXISTS post_journal_entry(TEXT, UUID, DATE, TEXT, JSONB);

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
    RAISE EXCEPTION 'Only admins can post journal entries';
  END IF;

  IF COALESCE(jsonb_typeof(p_lines), '') <> 'array' OR COALESCE(jsonb_array_length(p_lines), 0) < 2 THEN
    RAISE EXCEPTION 'Journal entry requires at least two lines';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_account_id := (v_line->>'account_id')::UUID;
    v_debit := COALESCE((v_line->>'debit')::NUMERIC, 0);
    v_credit := COALESCE((v_line->>'credit')::NUMERIC, 0);

    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'Journal line account_id is required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE id = v_account_id AND active = TRUE) THEN
      RAISE EXCEPTION 'Invalid or inactive account_id %', v_account_id;
    END IF;

    IF (v_debit > 0 AND v_credit > 0) OR (v_debit = 0 AND v_credit = 0) THEN
      RAISE EXCEPTION 'Each journal line must have either debit or credit, not both/neither';
    END IF;

    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
  END LOOP;

  IF v_total_debit <= 0 OR ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry must balance: debit %, credit %', v_total_debit, v_total_credit;
  END IF;

  -- Explicit business wins (validated); otherwise inherit from the source document.
  v_business := COALESCE(
    accounting_resolve_business(p_business),
    accounting_source_business(p_source_type, p_source_id)
  );

  v_entry_number := 'JE-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));

  INSERT INTO ledger_journal_entries (
    entry_number,
    source_type,
    source_id,
    entry_date,
    memo,
    status,
    business,
    created_by,
    posted_at
  )
  VALUES (
    v_entry_number,
    p_source_type,
    p_source_id,
    COALESCE(p_entry_date, CURRENT_DATE),
    p_memo,
    'posted',
    v_business,
    auth.uid(),
    NOW()
  )
  RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO ledger_journal_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      contact_id,
      tax_rate_id,
      description,
      metadata
    )
    VALUES (
      v_entry_id,
      (v_line->>'account_id')::UUID,
      COALESCE((v_line->>'debit')::NUMERIC, 0),
      COALESCE((v_line->>'credit')::NUMERIC, 0),
      NULLIF(v_line->>'contact_id', '')::UUID,
      NULLIF(v_line->>'tax_rate_id', '')::UUID,
      v_line->>'description',
      COALESCE(v_line->'metadata', '{}'::jsonb)
    );
  END LOOP;

  PERFORM assert_ledger_entry_balanced(v_entry_id);
  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION post_journal_entry(TEXT, UUID, DATE, TEXT, JSONB, TEXT) TO authenticated, service_role;
