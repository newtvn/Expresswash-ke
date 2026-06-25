-- Customer credit allocation workflow
-- - separates unapplied customer payments from accounts receivable in the ledger
-- - exposes admin-only allocation/credit option RPCs for the UI

INSERT INTO chart_of_accounts (code, name, account_type, normal_balance, system_key, description)
VALUES ('2200', 'Customer Credits', 'liability', 'credit', 'customer_credits', 'Unapplied customer payments and deposits')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  account_type = EXCLUDED.account_type,
  normal_balance = EXCLUDED.normal_balance,
  system_key = EXCLUDED.system_key,
  description = EXCLUDED.description,
  active = TRUE;

CREATE OR REPLACE FUNCTION post_payment_received_to_ledger(p_payment_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_payment RECORD;
  v_contact_id UUID;
  v_entry_id UUID;
  v_cash_account UUID;
  v_ar_account UUID := accounting_system_account_id('accounts_receivable');
  v_credit_account UUID := accounting_system_account_id('customer_credits');
  v_payment_amount NUMERIC(12,2);
  v_allocated_amount NUMERIC(12,2);
  v_unapplied_amount NUMERIC(12,2);
  v_lines JSONB := '[]'::jsonb;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can post payments';
  END IF;

  SELECT * INTO v_payment
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF v_payment.posted_journal_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'journal_entry_id', v_payment.posted_journal_entry_id);
  END IF;

  IF v_payment.status::TEXT <> 'completed' THEN
    RAISE EXCEPTION 'Only completed payments can be posted';
  END IF;

  v_payment_amount := ROUND(COALESCE(v_payment.amount, 0), 2);

  SELECT ROUND(COALESCE(SUM(amount_allocated), 0), 2)
  INTO v_allocated_amount
  FROM payment_allocations
  WHERE payment_id = p_payment_id;

  v_allocated_amount := LEAST(v_payment_amount, COALESCE(v_allocated_amount, 0));
  v_unapplied_amount := ROUND(GREATEST(v_payment_amount - v_allocated_amount, 0), 2);

  v_contact_id := accounting_contact_for_profile(v_payment.customer_id, v_payment.customer_name, v_payment.phone_number, NULL);
  v_cash_account := accounting_cash_account_id(v_payment.method::TEXT);

  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_id', v_cash_account,
    'debit', v_payment_amount,
    'contact_id', v_contact_id,
    'description', 'Cash received'
  ));

  IF v_allocated_amount > 0 THEN
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_ar_account,
      'credit', v_allocated_amount,
      'contact_id', v_contact_id,
      'description', 'Reduce accounts receivable'
    ));
  END IF;

  IF v_unapplied_amount > 0 THEN
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', v_credit_account,
      'credit', v_unapplied_amount,
      'contact_id', v_contact_id,
      'description', 'Customer credit balance'
    ));
  END IF;

  v_entry_id := post_journal_entry(
    'payment_received',
    p_payment_id,
    COALESCE(v_payment.completed_at::DATE, v_payment.created_at::DATE, CURRENT_DATE),
    'Payment received' || COALESCE(' - ' || v_payment.reference, ''),
    v_lines
  );

  UPDATE payments
  SET posted_journal_entry_id = v_entry_id,
      unapplied_amount = v_unapplied_amount,
      updated_at = NOW()
  WHERE id = p_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'journal_entry_id', v_entry_id,
    'allocated_amount', v_allocated_amount,
    'unapplied_amount', v_unapplied_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION allocate_customer_payment(
  p_payment_id UUID,
  p_allocations JSONB
) RETURNS JSONB AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_alloc JSONB;
  v_invoice invoices%ROWTYPE;
  v_amount NUMERIC(12,2);
  v_payment_amount NUMERIC(12,2);
  v_total_allocated NUMERIC(12,2) := 0;
  v_previous_allocated NUMERIC(12,2) := 0;
  v_delta NUMERIC(12,2);
  v_new_paid NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_existing RECORD;
  v_contact_id UUID;
  v_ar_account UUID := accounting_system_account_id('accounts_receivable');
  v_credit_account UUID := accounting_system_account_id('customer_credits');
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can allocate payments';
  END IF;

  IF COALESCE(jsonb_typeof(p_allocations), '') <> 'array' OR COALESCE(jsonb_array_length(p_allocations), 0) = 0 THEN
    RAISE EXCEPTION 'At least one allocation is required';
  END IF;

  SELECT * INTO v_payment
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF v_payment.status::TEXT <> 'completed' THEN
    RAISE EXCEPTION 'Only completed payments can be allocated';
  END IF;

  v_payment_amount := ROUND(COALESCE(v_payment.amount, 0), 2);

  SELECT ROUND(COALESCE(SUM(amount_allocated), 0), 2)
  INTO v_previous_allocated
  FROM payment_allocations
  WHERE payment_id = p_payment_id;

  FOR v_existing IN
    SELECT pa.invoice_id, pa.amount_allocated, i.total, i.paid_amount, i.balance
    FROM payment_allocations pa
    JOIN invoices i ON i.id = pa.invoice_id
    WHERE pa.payment_id = p_payment_id
    FOR UPDATE OF i
  LOOP
    UPDATE invoices
    SET paid_amount = ROUND(GREATEST(COALESCE(paid_amount, 0) - COALESCE(v_existing.amount_allocated, 0), 0), 2),
        balance = ROUND(LEAST(
          COALESCE(total, 0),
          COALESCE(balance, GREATEST(COALESCE(total, 0) - COALESCE(paid_amount, 0), 0)) + COALESCE(v_existing.amount_allocated, 0)
        ), 2),
        status = CASE
          WHEN ROUND(LEAST(
            COALESCE(total, 0),
            COALESCE(balance, GREATEST(COALESCE(total, 0) - COALESCE(paid_amount, 0), 0)) + COALESCE(v_existing.amount_allocated, 0)
          ), 2) <= 0 THEN 'paid'::invoice_status
          WHEN ROUND(GREATEST(COALESCE(paid_amount, 0) - COALESCE(v_existing.amount_allocated, 0), 0), 2) > 0 THEN 'partial'::invoice_status
          ELSE 'pending'::invoice_status
        END,
        paid_at = CASE
          WHEN ROUND(LEAST(
            COALESCE(total, 0),
            COALESCE(balance, GREATEST(COALESCE(total, 0) - COALESCE(paid_amount, 0), 0)) + COALESCE(v_existing.amount_allocated, 0)
          ), 2) > 0 THEN NULL
          ELSE paid_at
        END,
        updated_at = NOW()
    WHERE id = v_existing.invoice_id;
  END LOOP;

  DELETE FROM payment_allocations WHERE payment_id = p_payment_id;

  FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    v_amount := ROUND(COALESCE(NULLIF(v_alloc->>'amount', '')::NUMERIC, 0), 2);
    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'Allocation amount must be greater than zero';
    END IF;

    SELECT * INTO v_invoice
    FROM invoices
    WHERE id = (v_alloc->>'invoice_id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invoice not found for allocation';
    END IF;

    IF v_invoice.customer_id IS DISTINCT FROM v_payment.customer_id
      AND lower(COALESCE(v_invoice.customer_name, '')) IS DISTINCT FROM lower(COALESCE(v_payment.customer_name, ''))
    THEN
      RAISE EXCEPTION 'Payment and invoice belong to different customers';
    END IF;

    v_total_allocated := ROUND(v_total_allocated + v_amount, 2);
    IF v_total_allocated > v_payment_amount THEN
      RAISE EXCEPTION 'Allocations exceed payment amount';
    END IF;

    IF v_amount > ROUND(COALESCE(v_invoice.balance, GREATEST(v_invoice.total - COALESCE(v_invoice.paid_amount, 0), 0)), 2) THEN
      RAISE EXCEPTION 'Allocation exceeds invoice balance';
    END IF;

    INSERT INTO payment_allocations (payment_id, invoice_id, amount_allocated, created_by)
    VALUES (p_payment_id, v_invoice.id, v_amount, auth.uid());

    v_new_paid := ROUND(COALESCE(v_invoice.paid_amount, 0) + v_amount, 2);
    v_new_balance := ROUND(GREATEST(COALESCE(v_invoice.balance, GREATEST(v_invoice.total - COALESCE(v_invoice.paid_amount, 0), 0)) - v_amount, 0), 2);

    UPDATE invoices
    SET paid_amount = v_new_paid,
        balance = v_new_balance,
        status = CASE
          WHEN v_new_balance <= 0 THEN 'paid'::invoice_status
          WHEN v_new_paid > 0 THEN 'partial'::invoice_status
          ELSE status
        END,
        paid_at = CASE WHEN v_new_balance <= 0 THEN NOW() ELSE paid_at END,
        updated_at = NOW()
    WHERE id = v_invoice.id;
  END LOOP;

  UPDATE payments
  SET unapplied_amount = ROUND(GREATEST(COALESCE(amount, 0) - v_total_allocated, 0), 2),
      updated_at = NOW()
  WHERE id = p_payment_id;

  IF v_total_allocated > 0 AND v_payment.posted_journal_entry_id IS NULL THEN
    PERFORM post_payment_received_to_ledger(p_payment_id);
  ELSIF v_payment.posted_journal_entry_id IS NOT NULL THEN
    v_delta := ROUND(v_total_allocated - COALESCE(v_previous_allocated, 0), 2);
    IF v_delta > 0 THEN
      v_contact_id := accounting_contact_for_profile(v_payment.customer_id, v_payment.customer_name, v_payment.phone_number, NULL);
      PERFORM post_journal_entry(
        'manual_adjustment',
        p_payment_id,
        CURRENT_DATE,
        'Apply customer credit to invoices',
        jsonb_build_array(
          jsonb_build_object(
            'account_id', v_credit_account,
            'debit', v_delta,
            'contact_id', v_contact_id,
            'description', 'Reduce customer credit balance'
          ),
          jsonb_build_object(
            'account_id', v_ar_account,
            'credit', v_delta,
            'contact_id', v_contact_id,
            'description', 'Apply customer credit to accounts receivable'
          )
        )
      );
    ELSIF v_delta < 0 THEN
      v_contact_id := accounting_contact_for_profile(v_payment.customer_id, v_payment.customer_name, v_payment.phone_number, NULL);
      PERFORM post_journal_entry(
        'manual_adjustment',
        p_payment_id,
        CURRENT_DATE,
        'Return invoice allocation to customer credit',
        jsonb_build_array(
          jsonb_build_object(
            'account_id', v_ar_account,
            'debit', ABS(v_delta),
            'contact_id', v_contact_id,
            'description', 'Restore accounts receivable'
          ),
          jsonb_build_object(
            'account_id', v_credit_account,
            'credit', ABS(v_delta),
            'contact_id', v_contact_id,
            'description', 'Restore customer credit balance'
          )
        )
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'allocated_amount', v_total_allocated,
    'unapplied_amount', GREATEST(v_payment_amount - v_total_allocated, 0)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_customer_payment_allocation_options(p_payment_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_allocated_amount NUMERIC(12,2);
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can view payment allocation options';
  END IF;

  SELECT * INTO v_payment
  FROM payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  SELECT ROUND(COALESCE(SUM(amount_allocated), 0), 2)
  INTO v_allocated_amount
  FROM payment_allocations
  WHERE payment_id = p_payment_id;

  RETURN jsonb_build_object(
    'payment', jsonb_build_object(
      'id', v_payment.id,
      'amount', ROUND(COALESCE(v_payment.amount, 0), 2),
      'allocated_amount', COALESCE(v_allocated_amount, 0),
      'unapplied_amount', ROUND(GREATEST(COALESCE(v_payment.amount, 0) - COALESCE(v_allocated_amount, 0), 0), 2),
      'customer_id', v_payment.customer_id,
      'customer_name', v_payment.customer_name,
      'status', v_payment.status,
      'posted_journal_entry_id', v_payment.posted_journal_entry_id
    ),
    'allocations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'invoice_id', pa.invoice_id,
        'invoice_number', i.invoice_number,
        'customer_name', i.customer_name,
        'amount_allocated', pa.amount_allocated,
        'invoice_balance', COALESCE(i.balance, GREATEST(COALESCE(i.total, 0) - COALESCE(i.paid_amount, 0), 0)),
        'allocated_at', pa.allocated_at
      ) ORDER BY i.invoice_number)
      FROM payment_allocations pa
      JOIN invoices i ON i.id = pa.invoice_id
      WHERE pa.payment_id = p_payment_id
    ), '[]'::jsonb),
    'open_invoices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'invoice_id', i.id,
        'invoice_number', i.invoice_number,
        'customer_name', i.customer_name,
        'total', i.total,
        'paid_amount', i.paid_amount,
        'balance', COALESCE(i.balance, GREATEST(COALESCE(i.total, 0) - COALESCE(i.paid_amount, 0), 0)),
        'current_payment_allocation', COALESCE(pa.current_amount, 0),
        'due_date', COALESCE(i.due_date::TEXT, i.due_at::DATE::TEXT),
        'status', i.status
      ) ORDER BY COALESCE(i.due_date, i.due_at::DATE), i.invoice_number)
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(amount_allocated) AS current_amount
        FROM payment_allocations
        WHERE payment_id = p_payment_id
        GROUP BY invoice_id
      ) pa ON pa.invoice_id = i.id
      WHERE i.status::TEXT NOT IN ('draft', 'cancelled', 'paid')
        AND COALESCE(i.balance, GREATEST(COALESCE(i.total, 0) - COALESCE(i.paid_amount, 0), 0)) + COALESCE(pa.current_amount, 0) > 0
        AND (
          i.customer_id IS NOT DISTINCT FROM v_payment.customer_id
          OR lower(COALESCE(i.customer_name, '')) = lower(COALESCE(v_payment.customer_name, ''))
        )
    ), '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION list_customer_credit_balances()
RETURNS JSONB AS $$
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can view customer credit balances';
  END IF;

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
      AND ROUND(GREATEST(COALESCE(p.amount, 0) - COALESCE(allocated.total_allocated, 0), 0), 2) > 0
  ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION post_payment_received_to_ledger(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION allocate_customer_payment(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_customer_payment_allocation_options(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION list_customer_credit_balances() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION get_customer_payment_allocation_options(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION list_customer_credit_balances() FROM PUBLIC, anon;
