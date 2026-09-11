\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

DO $$
DECLARE
  v_cash UUID := accounting_system_account_id('cash');
  v_other_income UUID := accounting_system_account_id('other_income');
  v_entry UUID;
  v_reversal UUID;
  v_second UUID;
  v_details JSONB;
  v_result JSONB;
  v_feed JSONB;
  v_cash_flow JSONB;
  v_cash_flow_before JSONB;
  v_expense UUID;
  v_invoice UUID;
  v_payment UUID;
  v_provider_payment UUID;
  v_provider_request UUID;
  v_provider_complete JSONB;
  v_refund JSONB;
  v_allocation_options JSONB;
  v_customer_credits JSONB;
  v_aging JSONB;
  v_unposted_invoice UUID;
  v_goalhub_invoice UUID;
  v_native_invoice UUID;
  v_native_payment UUID;
  v_native_payment_entry UUID;
  v_expected_failure BOOLEAN;
  v_receipt UUID;
  v_actor UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_actor, 'authenticated', 'authenticated', 'accounting-audit@example.test', '{}', '{"name":"Accounting Audit"}', NOW(), NOW());
  UPDATE profiles SET role = 'super_admin' WHERE id = v_actor;

  -- Journal detail and reversal: exact mirrored lines, preserved source, one time only.
  v_entry := post_journal_entry(
    'manual_adjustment', NULL, CURRENT_DATE - 1, 'audit reversal fixture',
    jsonb_build_array(
      jsonb_build_object('account_id', v_cash, 'debit', 321.45, 'description', 'Cash in'),
      jsonb_build_object('account_id', v_other_income, 'credit', 321.45, 'description', 'Income')
    ), 'expresswash'
  );
  v_reversal := reverse_journal_entry(v_entry, CURRENT_DATE, 'Fixture correction');

  IF NOT EXISTS (
    SELECT 1 FROM ledger_journal_entries
    WHERE id = v_entry AND status = 'reversed' AND reversed_entry_id = v_reversal AND business = 'expresswash'
  ) THEN RAISE EXCEPTION 'Original journal reversal linkage/status failed'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM ledger_journal_lines original
    JOIN ledger_journal_lines reversed
      ON reversed.journal_entry_id = v_reversal
     AND reversed.account_id = original.account_id
     AND reversed.debit = original.credit
     AND reversed.credit = original.debit
    WHERE original.journal_entry_id = v_entry
    GROUP BY original.journal_entry_id
    HAVING COUNT(*) = 2
  ) THEN RAISE EXCEPTION 'Reversal lines do not exactly mirror the original'; END IF;

  v_expected_failure := FALSE;
  BEGIN
    PERFORM reverse_journal_entry(v_entry, CURRENT_DATE, 'Duplicate reversal');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Only posted journal entries can be reversed' THEN
      RAISE EXCEPTION 'Second reversal failed for the wrong reason: %', SQLERRM;
    END IF;
    v_expected_failure := TRUE;
  END;
  IF NOT v_expected_failure THEN RAISE EXCEPTION 'Second reversal unexpectedly succeeded'; END IF;

  v_second := post_journal_entry(
    'manual_adjustment', NULL, CURRENT_DATE, 'date guard fixture',
    jsonb_build_array(
      jsonb_build_object('account_id', v_cash, 'debit', 10),
      jsonb_build_object('account_id', v_other_income, 'credit', 10)
    ), 'expresswash'
  );
  v_expected_failure := FALSE;
  BEGIN
    PERFORM reverse_journal_entry(v_second, CURRENT_DATE - 1, 'Invalid date');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Reversal date cannot precede the original entry date' THEN
      RAISE EXCEPTION 'Earlier-dated reversal failed for the wrong reason: %', SQLERRM;
    END IF;
    v_expected_failure := TRUE;
  END;
  IF NOT v_expected_failure THEN RAISE EXCEPTION 'Earlier-dated reversal unexpectedly succeeded'; END IF;

  v_details := get_ledger_journal_entries(200, 'expresswash');
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_details) row
    WHERE row->>'id' = v_entry::TEXT
      AND (row->>'amount')::NUMERIC = 321.45
      AND jsonb_array_length(row->'lines') = 2
      AND row->>'reversed_entry_id' = v_reversal::TEXT
  ) THEN RAISE EXCEPTION 'Journal detail RPC omitted amount, lines, or reversal link'; END IF;

  -- Goalhub received-cash feed is derived from cash-side ledger lines. This
  -- includes new cash event types without counting wallet/refund movements.
  v_cash_flow_before := get_ledger_cash_flow(CURRENT_DATE, CURRENT_DATE, 'goalhub');
  v_result := post_ingested_journal_entry('goalhub', 'booking_payment', 'audit-booking-cash', 1250, 'goalhub', CURRENT_DATE, 'mpesa', 'KES', 'Booking paid', '{}'::jsonb, 'audit-booking-cash');
  IF (v_result->>'success')::BOOLEAN IS NOT TRUE THEN RAISE EXCEPTION 'Goalhub booking fixture failed: %', v_result; END IF;
  v_result := post_ingested_journal_entry('goalhub', 'wallet_topup', 'audit-wallet-cash', 600, 'goalhub', CURRENT_DATE, 'mpesa', 'KES', 'Wallet top-up', '{}'::jsonb, 'audit-wallet-cash');
  IF (v_result->>'success')::BOOLEAN IS NOT TRUE THEN RAISE EXCEPTION 'Goalhub wallet fixture failed: %', v_result; END IF;
  v_result := post_ingested_journal_entry('goalhub', 'wallet_redemption', 'audit-wallet-redemption', 400, 'goalhub', CURRENT_DATE, NULL, 'KES', 'Wallet redeemed', '{}'::jsonb, 'audit-wallet-redemption');
  IF (v_result->>'success')::BOOLEAN IS NOT TRUE THEN RAISE EXCEPTION 'Goalhub redemption fixture failed: %', v_result; END IF;
  v_result := post_ingested_journal_entry('goalhub', 'refund', 'audit-wallet-refund', 100, 'goalhub', CURRENT_DATE, NULL, 'KES', 'Wallet refund', '{}'::jsonb, 'audit-wallet-refund');
  IF (v_result->>'success')::BOOLEAN IS NOT TRUE THEN RAISE EXCEPTION 'Goalhub refund fixture failed: %', v_result; END IF;

  v_feed := get_accounting_payments_received(CURRENT_DATE, CURRENT_DATE, 'goalhub');
  IF (SELECT COUNT(*) FROM jsonb_array_elements(v_feed) row WHERE row->>'external_id' LIKE 'audit-%') <> 2 THEN
    RAISE EXCEPTION 'Goalhub feed did not include exactly the two cash receipts: %', v_feed;
  END IF;
  IF (SELECT SUM((row->>'amount')::NUMERIC) FROM jsonb_array_elements(v_feed) row WHERE row->>'external_id' LIKE 'audit-%') <> 1850 THEN
    RAISE EXCEPTION 'Goalhub cash receipt total did not reconcile to 1850';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_feed) row
    WHERE row->>'external_id' IN ('audit-wallet-redemption', 'audit-wallet-refund')
  ) THEN RAISE EXCEPTION 'Non-cash Goalhub movement leaked into payments received'; END IF;

  v_cash_flow := get_ledger_cash_flow(CURRENT_DATE, CURRENT_DATE, 'goalhub');
  IF (v_cash_flow->>'total_inflows')::NUMERIC - (v_cash_flow_before->>'total_inflows')::NUMERIC <> 1850 THEN
    RAISE EXCEPTION 'Goalhub Payments Received does not reconcile to cash-flow inflows: %', v_cash_flow;
  END IF;

  -- Reversed external and native receipts no longer overstate Payments Received.
  SELECT journal_entry_id INTO v_reversal
  FROM ledger_ingest_events WHERE external_id = 'audit-booking-cash';
  PERFORM reverse_journal_entry(v_reversal, CURRENT_DATE, 'Reverse external cash receipt fixture');
  v_feed := get_accounting_payments_received(CURRENT_DATE, CURRENT_DATE, 'goalhub');
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_feed) row
    WHERE row->>'external_id' = 'audit-booking-cash'
  ) THEN RAISE EXCEPTION 'Reversed Goalhub receipt remained in Payments Received'; END IF;

  INSERT INTO invoices(
    invoice_number, customer_name, subtotal, vat_rate, vat_amount, discount,
    total, paid_amount, balance, status, issued_at, due_at, business
  ) VALUES (
    'AUDIT-NATIVE-REVERSAL', 'Native Reversal', 90, 0, 0, 0,
    90, 90, 0, 'paid', NOW(), NOW(), 'expresswash'
  ) RETURNING id INTO v_native_invoice;
  INSERT INTO payments(invoice_id, invoice_number, reference_number, customer_name, amount, method, status, completed_at, business)
  VALUES (v_native_invoice, 'AUDIT-NATIVE-REVERSAL', 'AUDIT-NATIVE-REVERSAL', 'Native Reversal', 90, 'cash', 'completed', NOW(), 'expresswash')
  RETURNING id INTO v_native_payment;
  v_native_payment_entry := post_journal_entry(
    'payment_received', v_native_payment, CURRENT_DATE, 'Native payment reversal fixture',
    jsonb_build_array(
      jsonb_build_object('account_id', v_cash, 'debit', 90),
      jsonb_build_object('account_id', accounting_system_account_id('accounts_receivable'), 'credit', 90)
    ), 'expresswash'
  );
  UPDATE payments SET posted_journal_entry_id = v_native_payment_entry WHERE id = v_native_payment;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(get_accounting_payments_received(CURRENT_DATE, CURRENT_DATE, 'expresswash')) row
    WHERE row->>'id' = v_native_payment::TEXT
  ) THEN RAISE EXCEPTION 'Posted native receipt missing before reversal'; END IF;
  PERFORM reverse_journal_entry(v_native_payment_entry, CURRENT_DATE, 'Reverse native cash receipt fixture');
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(get_accounting_payments_received(CURRENT_DATE, CURRENT_DATE, 'expresswash')) row
    WHERE row->>'id' = v_native_payment::TEXT
  ) THEN RAISE EXCEPTION 'Reversed native receipt remained in Payments Received'; END IF;

  -- Approval and posting are atomic; unapproved expenses cannot hit the ledger.
  INSERT INTO expenses(category, amount, description, payment_method, expense_date, status, business, created_by)
  VALUES ('supplies', 275, 'audit approved expense', 'cash', CURRENT_DATE, 'pending', 'expresswash', v_actor)
  RETURNING id INTO v_expense;
  v_result := approve_and_post_expense(v_expense);
  IF (v_result->>'success')::BOOLEAN IS NOT TRUE OR NOT EXISTS (
    SELECT 1 FROM expenses WHERE id = v_expense AND status = 'approved' AND posted_journal_entry_id IS NOT NULL
  ) THEN RAISE EXCEPTION 'Expense approval did not post atomically: %', v_result; END IF;

  INSERT INTO expenses(category, amount, description, payment_method, expense_date, status, business, created_by)
  VALUES ('fuel', 50, 'audit pending expense', 'cash', CURRENT_DATE, 'pending', 'expresswash', v_actor)
  RETURNING id INTO v_expense;
  v_expected_failure := FALSE;
  BEGIN
    PERFORM post_expense_to_ledger(v_expense);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Only approved expenses can be posted' THEN
      RAISE EXCEPTION 'Pending expense failed for the wrong reason: %', SQLERRM;
    END IF;
    v_expected_failure := TRUE;
  END;
  IF NOT v_expected_failure THEN RAISE EXCEPTION 'Pending expense unexpectedly posted'; END IF;
  PERFORM reject_unposted_expense(v_expense);
  IF (SELECT status FROM expenses WHERE id = v_expense) <> 'rejected' THEN RAISE EXCEPTION 'Expense rejection failed'; END IF;

  -- Refund source validation and cumulative cap.
  INSERT INTO invoices(
    invoice_number, customer_name, customer_email, subtotal, vat_rate, vat_amount,
    discount, total, paid_amount, balance, status, issued_at, due_at, business
  ) VALUES (
    'AUDIT-REFUND-INVOICE', 'Audit Customer', 'audit@example.test', 1000, 0, 0,
    0, 1000, 1000, 0, 'paid', NOW(), NOW(), 'expresswash'
  ) RETURNING id INTO v_invoice;
  INSERT INTO payments(invoice_id, invoice_number, customer_name, amount, method, status, completed_at, business)
  VALUES (v_invoice, 'AUDIT-REFUND-INVOICE', 'Audit Customer', 1000, 'mpesa', 'completed', NOW(), 'expresswash')
  RETURNING id INTO v_payment;
  INSERT INTO payment_allocations(payment_id, invoice_id, amount_allocated)
  VALUES (v_payment, v_invoice, 1000);

  v_allocation_options := get_customer_payment_allocation_options(v_payment);
  IF v_allocation_options->'payment'->>'id' <> v_payment::TEXT
    OR jsonb_array_length(v_allocation_options->'allocations') <> 1
  THEN RAISE EXCEPTION 'Payment allocation detail failed: %', v_allocation_options; END IF;

  v_refund := record_customer_refund(v_invoice, v_payment, 400, 'mpesa', 'AUDIT-RF-1', 'Customer-approved correction');
  IF (v_refund->>'success')::BOOLEAN IS NOT TRUE THEN RAISE EXCEPTION 'Valid refund failed: %', v_refund; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM customer_refunds
    WHERE id = (v_refund->>'refund_id')::UUID AND business = 'expresswash'
  ) THEN RAISE EXCEPTION 'Refund did not inherit its source business'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM ledger_journal_entries e
    JOIN ledger_journal_lines ar ON ar.journal_entry_id = e.id
    JOIN chart_of_accounts ar_coa ON ar_coa.id = ar.account_id AND ar_coa.system_key = 'accounts_receivable'
    JOIN ledger_journal_lines cash_line ON cash_line.journal_entry_id = e.id
    JOIN chart_of_accounts cash_coa ON cash_coa.id = cash_line.account_id AND cash_coa.system_key = 'mpesa'
    WHERE e.id = (v_refund->>'journal_entry_id')::UUID
      AND e.business = 'expresswash' AND ar.debit = 400 AND cash_line.credit = 400
  ) THEN RAISE EXCEPTION 'Refund ledger directions/business are incorrect'; END IF;

  v_refund := record_customer_refund(v_invoice, v_payment, 601, 'mpesa', NULL, 'Exceeds cap');
  IF (v_refund->>'success')::BOOLEAN IS NOT FALSE OR v_refund->>'error' NOT LIKE 'Refund amount exceeds%' THEN
    RAISE EXCEPTION 'Cumulative refund cap failed: %', v_refund;
  END IF;

  -- Provider refunds reserve one request without posting cash until settlement.
  INSERT INTO payments(
    invoice_id, invoice_number, customer_name, amount, method, status,
    completed_at, business, provider, provider_payment_id, provider_status,
    provider_metadata, mpesa_receipt_number
  ) VALUES (
    v_invoice, 'AUDIT-REFUND-INVOICE', 'Audit Customer', 1000, 'mpesa', 'completed',
    NOW(), 'expresswash', 'pesapal', 'audit-provider-payment', 'completed',
    '{"currency":"KES"}'::jsonb, 'AUDIT-CONFIRMATION'
  ) RETURNING id INTO v_provider_payment;

  v_result := prepare_provider_refund_request(v_provider_payment, 1000, 'Provider refund fixture', 'audit-provider-refund-1');
  v_provider_request := (v_result->>'request_id')::UUID;
  IF (v_result->>'success')::BOOLEAN IS NOT TRUE OR (v_result->>'idempotent')::BOOLEAN IS TRUE THEN
    RAISE EXCEPTION 'Provider refund reservation failed: %', v_result;
  END IF;
  IF EXISTS (
    SELECT 1 FROM provider_refund_requests
    WHERE id = v_provider_request AND (customer_refund_id IS NOT NULL OR posted_journal_entry_id IS NOT NULL)
  ) THEN RAISE EXCEPTION 'Provider reservation posted accounting before completion'; END IF;

  v_result := prepare_provider_refund_request(v_provider_payment, 1000, 'Provider refund fixture', 'audit-provider-refund-1');
  IF (v_result->>'idempotent')::BOOLEAN IS NOT TRUE OR (v_result->>'request_id')::UUID <> v_provider_request THEN
    RAISE EXCEPTION 'Provider refund idempotency failed: %', v_result;
  END IF;

  v_expected_failure := FALSE;
  BEGIN
    PERFORM prepare_provider_refund_request(v_provider_payment, 1000, 'Provider refund fixture', 'audit-provider-refund-2');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Only one provider refund request is allowed per payment' THEN
      RAISE EXCEPTION 'Second provider request failed for the wrong reason: %', SQLERRM;
    END IF;
    v_expected_failure := TRUE;
  END;
  IF NOT v_expected_failure THEN RAISE EXCEPTION 'Second provider refund request unexpectedly succeeded'; END IF;

  -- Provider submission state is server-owned, even for a super admin.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_actor)::TEXT,
    true
  );
  v_expected_failure := FALSE;
  BEGIN
    PERFORM mark_provider_refund_submission(
      v_provider_request, 'processing', 'Forged browser-side provider result',
      'AUDIT-CONFIRMATION', 'M-PESA'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_expected_failure := TRUE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Direct admin provider mutation failed for the wrong reason: %', SQLERRM;
  END;
  IF NOT v_expected_failure THEN RAISE EXCEPTION 'Admin directly changed provider submission state'; END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  PERFORM mark_provider_refund_submission(
    v_provider_request, 'processing', 'Refund request successfully',
    'AUDIT-CONFIRMATION', 'M-PESA'
  );
  IF EXISTS (
    SELECT 1 FROM provider_refund_requests
    WHERE id = v_provider_request AND (status <> 'processing' OR posted_journal_entry_id IS NOT NULL)
  ) THEN RAISE EXCEPTION 'Provider acceptance was incorrectly treated as completed'; END IF;

  v_provider_complete := complete_provider_refund_request(v_provider_request, 'AUDIT-SETTLEMENT-EVIDENCE');
  IF (v_provider_complete->>'success')::BOOLEAN IS NOT TRUE
    OR v_provider_complete->>'status' <> 'completed'
  THEN RAISE EXCEPTION 'Provider refund completion failed: %', v_provider_complete; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM provider_refund_requests
    WHERE id = v_provider_request AND status = 'completed'
      AND customer_refund_id IS NOT NULL AND posted_journal_entry_id IS NOT NULL
      AND completion_evidence_reference = 'AUDIT-SETTLEMENT-EVIDENCE'
  ) THEN RAISE EXCEPTION 'Completed provider refund is missing accounting/evidence links'; END IF;

  v_provider_complete := complete_provider_refund_request(v_provider_request, 'AUDIT-SETTLEMENT-EVIDENCE');
  IF (v_provider_complete->>'idempotent')::BOOLEAN IS NOT TRUE THEN
    RAISE EXCEPTION 'Provider completion replay was not idempotent: %', v_provider_complete;
  END IF;

  v_expected_failure := FALSE;
  BEGIN
    PERFORM mark_provider_refund_submission(
      v_provider_request, 'rejected', 'Late provider response must not rewrite settlement',
      'AUDIT-CONFIRMATION', 'M-PESA'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Provider refund request cannot transition from completed' THEN
      RAISE EXCEPTION 'Completed provider mutation failed for the wrong reason: %', SQLERRM;
    END IF;
    v_expected_failure := TRUE;
  END;
  IF NOT v_expected_failure THEN
    RAISE EXCEPTION 'Completed provider refund was mutable';
  END IF;

  -- Customer credits and aging are scoped/recognized at the accounting boundary.
  INSERT INTO invoices(
    invoice_number, customer_name, subtotal, vat_rate, vat_amount, discount,
    total, paid_amount, balance, status, issued_at, due_at, business
  ) VALUES (
    'AUDIT-GOALHUB-CREDIT', 'Goalhub Credit', 77, 0, 0, 0,
    77, 77, 0, 'paid', NOW(), NOW(), 'goalhub'
  ) RETURNING id INTO v_goalhub_invoice;
  INSERT INTO payments(invoice_id, invoice_number, reference_number, customer_name, amount, unapplied_amount, method, status, completed_at, business)
  VALUES (v_goalhub_invoice, 'AUDIT-GOALHUB-CREDIT', 'AUDIT-GOALHUB-CREDIT', 'Goalhub Credit', 77, 77, 'mpesa', 'completed', NOW(), 'goalhub');
  v_customer_credits := list_customer_credit_balances('expresswash');
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_customer_credits) row
    WHERE row->>'provider_reference' = 'AUDIT-GOALHUB-CREDIT'
       OR row->>'customer_name' = 'Goalhub Credit'
  ) THEN RAISE EXCEPTION 'Goalhub customer credit leaked into Expresswash results'; END IF;

  INSERT INTO invoices(
    invoice_number, customer_name, subtotal, vat_rate, vat_amount, discount,
    total, paid_amount, balance, status, issued_at, due_at, business
  ) VALUES (
    'AUDIT-UNPOSTED-AGING', 'Draft Customer', 50, 0, 0, 0,
    50, 0, 50, 'sent', NOW(), NOW(), 'expresswash'
  ) RETURNING id INTO v_unposted_invoice;
  v_aging := get_receivables_aging(CURRENT_DATE, 'expresswash');
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_aging->'items') row
    WHERE row->>'invoice_id' = v_unposted_invoice::TEXT
  ) THEN RAISE EXCEPTION 'Unposted invoice leaked into receivables aging'; END IF;

  -- Receipts remain available as evidence after voiding.
  INSERT INTO receipts(vendor, description, amount, category, date, business)
  VALUES ('Audit Vendor', 'Audit receipt', 99, 'Supplies', CURRENT_DATE, 'expresswash')
  RETURNING id INTO v_receipt;
  PERFORM void_receipt(v_receipt, 'Duplicate source document');
  IF NOT EXISTS (
    SELECT 1 FROM receipts WHERE id = v_receipt AND status = 'void' AND voided_at IS NOT NULL AND void_reason = 'Duplicate source document'
  ) THEN RAISE EXCEPTION 'Receipt was not preserved and voided correctly'; END IF;

  -- SECURITY DEFINER writes still enforce the caller's business boundary.
  UPDATE profiles SET role = 'admin' WHERE id = v_actor;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_actor::TEXT, true);
  IF NOT accounting_is_admin() OR is_super_admin() THEN RAISE EXCEPTION 'Regular-admin fixture claims are invalid'; END IF;
  v_expected_failure := FALSE;
  BEGIN
    PERFORM post_journal_entry(
      'manual_adjustment', NULL, CURRENT_DATE, 'forbidden cross-business fixture',
      jsonb_build_array(
        jsonb_build_object('account_id', v_cash, 'debit', 1),
        jsonb_build_object('account_id', v_other_income, 'credit', 1)
      ), 'goalhub'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_expected_failure := TRUE;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Cross-business post failed for the wrong reason: %', SQLERRM;
  END;
  IF NOT v_expected_failure THEN RAISE EXCEPTION 'Regular admin unexpectedly posted to Goalhub'; END IF;
END $$;

ROLLBACK;
