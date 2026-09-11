-- Regression: refunding a paid invoice reverses revenue and output VAT, pays
-- cash out once, leaves A/R net zero, and creates an auditable credit note.
BEGIN;

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

DO $$
DECLARE
  v_customer UUID;
  v_order UUID := '96000000-0000-0000-0000-000000000001';
  v_payment UUID := '96000000-0000-0000-0000-000000000003';
  v_invoice_id UUID;
  v_result JSONB;
  v_duplicate JSONB;
  v_refund_id UUID;
  v_credit_note_id UUID;
  v_refund_entry UUID;
  v_credit_entry UUID;
  v_sales UUID := accounting_system_account_id('sales_revenue');
  v_vat UUID := accounting_system_account_id('vat_payable');
  v_ar UUID := accounting_system_account_id('accounts_receivable');
  v_cash UUID := accounting_cash_account_id('mpesa');
  v_amount NUMERIC(12,2);
BEGIN
  SELECT id INTO v_customer FROM profiles ORDER BY created_at LIMIT 1;
  IF v_customer IS NULL THEN RAISE EXCEPTION 'A seeded profile is required'; END IF;

  INSERT INTO orders(id, tracking_code, customer_id, customer_name, status, zone,
    subtotal, delivery_fee, vat, total, payment_status, payment_method, customer_phone)
  VALUES (v_order, 'QA-REFUND-REV-096', v_customer, 'QA Refund Accounting', 2, 'QA',
    100, 0, 16, 116, 'unpaid', 'mpesa', '254700000000');
  INSERT INTO order_items(id, order_id, name, quantity, item_type, unit_price, total_price)
  VALUES ('96000000-0000-0000-0000-000000000002', v_order,
    'QA refundable item', 1, 'carpet', 100, 100);
  INSERT INTO payments(id, order_id, customer_id, customer_name, amount, method,
    status, provider, provider_payment_id, provider_reference, provider_status,
    business, phone_number)
  VALUES (v_payment, v_order, v_customer, 'QA Refund Accounting', 116, 'mpesa',
    'processing', 'pesapal', 'qa-provider-refund-096', 'QA-REFUND-REV-096', 'initiated',
    'expresswash', '254700000000');
  UPDATE payments SET status = 'completed', completed_at = NOW(), provider_status = 'completed'
  WHERE id = v_payment;

  SELECT id INTO v_invoice_id FROM invoices WHERE order_id = v_order;
  v_result := record_customer_refund(v_invoice_id, v_payment, 116, 'mpesa',
    'QA-REFUND-096', 'QA refund accounting regression');
  IF NOT COALESCE((v_result->>'success')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'Refund failed: %', v_result;
  END IF;

  v_refund_id := (v_result->>'refund_id')::UUID;
  v_credit_note_id := (v_result->>'credit_note_id')::UUID;
  v_refund_entry := (v_result->>'journal_entry_id')::UUID;
  v_credit_entry := (v_result->>'credit_note_journal_entry_id')::UUID;

  IF v_credit_note_id IS NULL OR v_credit_entry IS NULL THEN
    RAISE EXCEPTION 'Refund did not create its credit note trail: %', v_result;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM customer_refunds
    WHERE id = v_refund_id AND credit_note_id = v_credit_note_id AND amount = 116
  ) THEN RAISE EXCEPTION 'Refund and credit note are not linked'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM credit_notes
    WHERE id = v_credit_note_id AND subtotal = 100 AND tax_total = 16
      AND total = 116 AND status = 'applied'
  ) THEN RAISE EXCEPTION 'Credit note totals are incorrect'; END IF;

  SELECT COALESCE(SUM(debit - credit), 0) INTO v_amount
  FROM ledger_journal_lines WHERE journal_entry_id = v_credit_entry AND account_id = v_sales;
  IF v_amount <> 100 THEN RAISE EXCEPTION 'Revenue reversal mismatch: %', v_amount; END IF;
  SELECT COALESCE(SUM(debit - credit), 0) INTO v_amount
  FROM ledger_journal_lines WHERE journal_entry_id = v_credit_entry AND account_id = v_vat;
  IF v_amount <> 16 THEN RAISE EXCEPTION 'VAT reversal mismatch: %', v_amount; END IF;
  SELECT COALESCE(SUM(debit - credit), 0) INTO v_amount
  FROM ledger_journal_lines
  WHERE journal_entry_id IN (v_credit_entry, v_refund_entry) AND account_id = v_ar;
  IF v_amount <> 0 THEN RAISE EXCEPTION 'A/R did not net to zero: %', v_amount; END IF;
  SELECT COALESCE(SUM(credit - debit), 0) INTO v_amount
  FROM ledger_journal_lines WHERE journal_entry_id = v_refund_entry AND account_id = v_cash;
  IF v_amount <> 116 THEN RAISE EXCEPTION 'Cash refund mismatch: %', v_amount; END IF;

  v_duplicate := record_customer_refund(v_invoice_id, v_payment, 116, 'mpesa',
    'QA-REFUND-096-REPLAY', 'Duplicate must be rejected');
  IF COALESCE((v_duplicate->>'success')::BOOLEAN, FALSE)
    OR COALESCE(v_duplicate->>'error', '') NOT LIKE 'Refund amount exceeds remaining refundable amount%'
  THEN RAISE EXCEPTION 'Duplicate refund was not rejected: %', v_duplicate; END IF;
END;
$$;

ROLLBACK;

