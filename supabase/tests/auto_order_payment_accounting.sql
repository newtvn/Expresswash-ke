-- Regression: a provider payment completed before delivery must create and
-- settle exactly one linked invoice, allocate the payment, and post both sides.
BEGIN;

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

DO $$
DECLARE
  v_customer UUID;
  v_order UUID := '93000000-0000-0000-0000-000000000001';
  v_payment UUID := '93000000-0000-0000-0000-000000000003';
  v_invoice invoices%ROWTYPE;
  v_payment_row payments%ROWTYPE;
  v_allocated NUMERIC(12,2);
  v_invoice_count INTEGER;
BEGIN
  SELECT id INTO v_customer FROM profiles ORDER BY created_at LIMIT 1;
  IF v_customer IS NULL THEN RAISE EXCEPTION 'A seeded profile is required'; END IF;

  INSERT INTO orders(id, tracking_code, customer_id, customer_name, status, zone,
    subtotal, delivery_fee, vat, total, payment_status, payment_method, customer_phone)
  VALUES (v_order, 'QA-AUTO-PAY-093', v_customer, 'QA Automatic Payment', 2, 'QA',
    100, 0, 16, 116, 'unpaid', 'mpesa', '254700000000');

  INSERT INTO order_items(id, order_id, name, quantity, item_type, unit_price, total_price)
  VALUES ('93000000-0000-0000-0000-000000000002', v_order,
    'QA paid order item', 1, 'carpet', 100, 100);

  INSERT INTO payments(id, order_id, customer_id, customer_name, amount, method,
    status, provider, provider_payment_id, provider_reference, provider_status,
    business, phone_number)
  VALUES (v_payment, v_order, v_customer, 'QA Automatic Payment', 116, 'mpesa',
    'processing', 'pesapal', 'qa-provider-093', 'QA-AUTO-PAY-093', 'initiated',
    'expresswash', '254700000000');

  UPDATE payments
  SET status = 'completed', completed_at = NOW(), provider_status = 'completed'
  WHERE id = v_payment;

  SELECT * INTO v_invoice FROM invoices WHERE order_id = v_order;
  IF NOT FOUND OR v_invoice.status::TEXT <> 'paid' OR v_invoice.total <> 116
    OR v_invoice.balance <> 0 OR v_invoice.posted_journal_entry_id IS NULL
  THEN
    RAISE EXCEPTION 'Automatic invoice mismatch: %', row_to_json(v_invoice);
  END IF;

  SELECT * INTO v_payment_row FROM payments WHERE id = v_payment;
  SELECT amount_allocated INTO v_allocated
  FROM payment_allocations
  WHERE payment_id = v_payment AND invoice_id = v_invoice.id;

  IF v_payment_row.invoice_id IS DISTINCT FROM v_invoice.id
    OR v_payment_row.unapplied_amount <> 0
    OR v_payment_row.posted_journal_entry_id IS NULL
    OR v_allocated <> 116
  THEN
    RAISE EXCEPTION 'Automatic payment reconciliation mismatch';
  END IF;

  -- A duplicate completion signal must reuse the invoice and allocation.
  UPDATE payments SET status = 'completed' WHERE id = v_payment;
  SELECT COUNT(*) INTO v_invoice_count FROM invoices WHERE order_id = v_order;
  IF v_invoice_count <> 1 THEN
    RAISE EXCEPTION 'Expected one invoice, got %', v_invoice_count;
  END IF;
END;
$$;

DO $$
DECLARE
  v_customer UUID;
  v_order UUID := '94000000-0000-0000-0000-000000000001';
  v_payment UUID := '94000000-0000-0000-0000-000000000003';
  v_status TEXT;
  v_reconciliation_status TEXT;
BEGIN
  SELECT id INTO v_customer FROM profiles ORDER BY created_at LIMIT 1;

  -- A legacy total mismatch is flagged, but the provider-confirmed payment
  -- remains completed instead of being rolled back to processing.
  INSERT INTO orders(id, tracking_code, customer_id, customer_name, status, zone,
    subtotal, delivery_fee, vat, total, payment_status, payment_method)
  VALUES (v_order, 'QA-AUTO-FAIL-094', v_customer, 'QA Automatic Payment', 2,
    'QA', 100, 0, 16, 999, 'unpaid', 'mpesa');
  INSERT INTO order_items(id, order_id, name, quantity, item_type, unit_price, total_price)
  VALUES ('94000000-0000-0000-0000-000000000002', v_order,
    'Legacy inconsistent item', 1, 'carpet', 100, 100);
  INSERT INTO payments(id, order_id, customer_id, customer_name, amount, method,
    status, provider, provider_payment_id, provider_status, business)
  VALUES (v_payment, v_order, v_customer, 'QA Automatic Payment', 999, 'mpesa',
    'processing', 'pesapal', 'qa-provider-fail-094', 'initiated', 'expresswash');

  UPDATE payments SET status = 'completed', provider_status = 'completed' WHERE id = v_payment;
  SELECT status::TEXT, provider_metadata->'accountingReconciliation'->>'status'
  INTO v_status, v_reconciliation_status FROM payments WHERE id = v_payment;
  IF v_status <> 'completed' OR v_reconciliation_status <> 'failed' THEN
    RAISE EXCEPTION 'Provider payment was not safely preserved and flagged';
  END IF;
END;
$$;

-- Authenticated non-service cash recording is not intercepted by automation.
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true);
DO $$
DECLARE
  v_customer UUID;
  v_order UUID := '94000000-0000-0000-0000-000000000011';
BEGIN
  SELECT id INTO v_customer FROM profiles ORDER BY created_at LIMIT 1;
  INSERT INTO orders(id, tracking_code, customer_id, customer_name, status, zone,
    subtotal, delivery_fee, vat, total, payment_status, payment_method)
  VALUES (v_order, 'QA-DRIVER-CASH-094', v_customer, 'QA Driver Cash', 12,
    'QA', 100, 0, 16, 116, 'unpaid', 'cash');
  INSERT INTO order_items(id, order_id, name, quantity, item_type, unit_price, total_price)
  VALUES ('94000000-0000-0000-0000-000000000012', v_order,
    'QA driver cash item', 1, 'carpet', 100, 100);
  INSERT INTO payments(id, order_id, customer_id, customer_name, amount, method,
    status, provider, provider_status, business)
  VALUES ('94000000-0000-0000-0000-000000000013', v_order, v_customer,
    'QA Driver Cash', 116, 'cash', 'completed', 'manual', 'completed', 'expresswash');
  IF EXISTS (SELECT 1 FROM invoices WHERE order_id = v_order) THEN
    RAISE EXCEPTION 'Authenticated cash row was unexpectedly auto-invoiced';
  END IF;
END;
$$;

ROLLBACK;
