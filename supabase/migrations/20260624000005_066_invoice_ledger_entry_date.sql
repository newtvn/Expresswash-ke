-- Migration: Use invoice issue date for ledger postings
--
-- Invoice revenue/receivable entries belong on the invoice issue date. Using
-- the payment due date can make balance-sheet snapshots show payments without
-- their matching receivable/revenue posting.

CREATE OR REPLACE FUNCTION post_invoice_to_ledger(p_invoice_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_invoice RECORD;
  v_contact_id UUID;
  v_entry_id UUID;
  v_entry_date DATE;
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
  v_entry_date := COALESCE(v_invoice.issued_at::DATE, v_invoice.created_at::DATE, CURRENT_DATE);

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
    v_entry_date,
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

UPDATE ledger_journal_entries e
SET entry_date = COALESCE(i.issued_at::DATE, i.created_at::DATE, e.entry_date),
    updated_at = NOW()
FROM invoices i
WHERE e.source_type = 'invoice'
  AND e.source_id = i.id
  AND e.status = 'posted'
  AND e.entry_date > COALESCE(i.issued_at::DATE, i.created_at::DATE, e.entry_date);
