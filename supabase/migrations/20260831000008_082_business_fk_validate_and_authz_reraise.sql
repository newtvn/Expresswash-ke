-- B3 hardening (follow-up to 076/081):
--   1. Validate the ledger business FK now that every row is tagged.
--   2. update_draft_invoice_with_lines: propagate authz denials instead of
--      masking them as a soft { success:false } result.

-- 1. Validate the DEFERRABLE NOT VALID FK added in 076. Native rows were
--    backfilled to 'expresswash' and ingested rows carry a registered slug, so
--    every existing row already satisfies it; this just promotes it to VALID so
--    the planner and future checks trust it. Idempotent: skip if already valid.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ledger_journal_entries_business_fkey' AND NOT convalidated
  ) THEN
    ALTER TABLE ledger_journal_entries
      VALIDATE CONSTRAINT ledger_journal_entries_business_fkey;
  END IF;
END $$;

-- 2. Re-raise the RLS-compensating authz guard. update_draft runs SECURITY
--    DEFINER, so it bypasses the 080 row filter and checks business access
--    itself; that RAISE was being swallowed by the trailing WHEN OTHERS and
--    returned as a benign failure. Denials must surface as insufficient_privilege
--    (the repository maps a thrown error to a failed operation just the same),
--    so a real authz problem is never confused with a validation error.
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
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
