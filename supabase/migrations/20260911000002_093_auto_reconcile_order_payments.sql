-- Automatically turn a successful order payment into canonical accounting.
-- Provider callbacks run as service_role, while browser callers remain admin-only.

CREATE OR REPLACE FUNCTION public.accounting_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(auth.jwt()->>'role', '') = 'service_role' OR is_admin();
EXCEPTION WHEN undefined_function THEN
  RETURN COALESCE(auth.jwt()->>'role', '') = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reconcile_order_invoice_payments(
  p_order_id UUID,
  p_invoice_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_payment payments%ROWTYPE;
  v_payment_total NUMERIC(12,2);
  v_allocated NUMERIC(12,2);
  v_available NUMERIC(12,2);
  v_apply NUMERIC(12,2);
  v_total_applied NUMERIC(12,2) := 0;
  v_contact_id UUID;
  v_ar_account UUID := accounting_system_account_id('accounts_receivable');
  v_credit_account UUID := accounting_system_account_id('customer_credits');
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins or the payment service can reconcile order payments';
  END IF;

  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR v_invoice.order_id IS DISTINCT FROM p_order_id THEN
    RAISE EXCEPTION 'Invoice is not linked to the supplied order';
  END IF;

  IF v_invoice.posted_journal_entry_id IS NULL THEN
    PERFORM post_invoice_to_ledger(v_invoice.id);
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  END IF;

  FOR v_payment IN
    SELECT * FROM payments
    WHERE order_id = p_order_id AND status::TEXT = 'completed'
    ORDER BY COALESCE(completed_at, created_at), id
    FOR UPDATE
  LOOP
    v_payment_total := ROUND(COALESCE(v_payment.amount, 0), 2);
    SELECT ROUND(COALESCE(SUM(amount_allocated), 0), 2)
      INTO v_allocated
      FROM payment_allocations
      WHERE payment_id = v_payment.id;
    v_available := ROUND(GREATEST(v_payment_total - COALESCE(v_allocated, 0), 0), 2);
    v_apply := LEAST(v_available, ROUND(GREATEST(COALESCE(v_invoice.balance, 0), 0), 2));

    IF v_apply > 0 THEN
      INSERT INTO payment_allocations(payment_id, invoice_id, amount_allocated, created_by)
      VALUES (v_payment.id, v_invoice.id, v_apply, auth.uid())
      ON CONFLICT (payment_id, invoice_id) DO UPDATE
        SET amount_allocated = payment_allocations.amount_allocated + EXCLUDED.amount_allocated,
            allocated_at = NOW();

      UPDATE invoices
      SET paid_amount = ROUND(COALESCE(paid_amount, 0) + v_apply, 2),
          balance = ROUND(GREATEST(COALESCE(balance, total) - v_apply, 0), 2),
          status = CASE
            WHEN ROUND(GREATEST(COALESCE(balance, total) - v_apply, 0), 2) = 0 THEN 'paid'::invoice_status
            ELSE 'partial'::invoice_status
          END,
          paid_at = CASE
            WHEN ROUND(GREATEST(COALESCE(balance, total) - v_apply, 0), 2) = 0 THEN COALESCE(paid_at, v_payment.completed_at, NOW())
            ELSE paid_at
          END,
          updated_at = NOW()
      WHERE id = v_invoice.id
      RETURNING * INTO v_invoice;

      IF v_payment.posted_journal_entry_id IS NOT NULL THEN
        v_contact_id := accounting_contact_for_profile(v_payment.customer_id, v_payment.customer_name, v_payment.phone_number, NULL);
        PERFORM post_journal_entry(
          'manual_adjustment', v_payment.id, CURRENT_DATE,
          'Apply order payment credit to invoice',
          jsonb_build_array(
            jsonb_build_object('account_id', v_credit_account, 'debit', v_apply, 'contact_id', v_contact_id, 'description', 'Reduce customer credit balance'),
            jsonb_build_object('account_id', v_ar_account, 'credit', v_apply, 'contact_id', v_contact_id, 'description', 'Apply order payment to accounts receivable')
          )
        );
      END IF;
      v_total_applied := ROUND(v_total_applied + v_apply, 2);
    END IF;

    UPDATE payments
    SET invoice_id = COALESCE(invoice_id, v_invoice.id),
        invoice_number = COALESCE(invoice_number, v_invoice.invoice_number),
        unapplied_amount = ROUND(GREATEST(v_payment_total - COALESCE(v_allocated, 0) - v_apply, 0), 2),
        updated_at = NOW()
    WHERE id = v_payment.id;

    IF v_payment.posted_journal_entry_id IS NULL THEN
      PERFORM post_payment_received_to_ledger(v_payment.id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'invoice_id', v_invoice.id,
    'applied_amount', v_total_applied,
    'paid_amount', v_invoice.paid_amount,
    'balance', v_invoice.balance,
    'status', v_invoice.status::TEXT
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.reconcile_order_invoice_payments(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_order_invoice_payments(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.create_invoice_from_delivered_order(
  p_order_id UUID,
  p_due_date DATE DEFAULT NULL,
  p_post BOOLEAN DEFAULT TRUE,
  p_business TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_profile RECORD;
  v_existing RECORD;
  v_item RECORD;
  v_contact_id UUID;
  v_invoice_id UUID;
  v_result JSONB;
  v_reconcile JSONB;
  v_lines JSONB := '[]'::JSONB;
  v_component_count INTEGER := 0;
  v_component_index INTEGER := 0;
  v_base_total NUMERIC(12,2) := 0;
  v_base NUMERIC(12,2);
  v_tax NUMERIC(12,2);
  v_allocated_tax NUMERIC(12,2) := 0;
  v_delivery_fee NUMERIC(12,2) := 0;
  v_vat NUMERIC(12,2) := 0;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins or the payment service can create order invoices';
  END IF;
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'Order is required'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::TEXT, 0));

  SELECT * INTO v_existing FROM invoices
  WHERE order_id = p_order_id AND status::TEXT <> 'cancelled'
  ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    v_reconcile := reconcile_order_invoice_payments(p_order_id, v_existing.id);
    RETURN jsonb_build_object('success', TRUE, 'idempotent', TRUE,
      'invoice_id', v_existing.id, 'invoice_number', v_existing.invoice_number,
      'reconciliation', v_reconcile);
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status <> 12 AND NOT EXISTS (
    SELECT 1 FROM payments WHERE order_id = p_order_id AND status::TEXT = 'completed'
  ) THEN
    RAISE EXCEPTION 'Only delivered or paid orders can be invoiced';
  END IF;

  SELECT email, phone INTO v_profile FROM profiles WHERE id = v_order.customer_id;
  v_contact_id := accounting_contact_for_profile(v_order.customer_id, v_order.customer_name,
    COALESCE(v_order.customer_phone, v_profile.phone), v_profile.email);
  IF v_contact_id IS NULL THEN RAISE EXCEPTION 'Order customer could not be linked to an accounting contact'; END IF;

  v_delivery_fee := ROUND(COALESCE(v_order.delivery_fee, 0), 2);
  v_vat := ROUND(COALESCE(v_order.vat, 0), 2);
  SELECT COUNT(*)::INTEGER, ROUND(COALESCE(SUM(COALESCE(total_price, unit_price * quantity)), 0), 2)
    INTO v_component_count, v_base_total FROM order_items
    WHERE order_id = p_order_id AND COALESCE(total_price, unit_price * quantity) > 0;
  IF v_delivery_fee > 0 THEN
    v_component_count := v_component_count + 1;
    v_base_total := v_base_total + v_delivery_fee;
  END IF;
  IF v_component_count = 0 OR v_base_total <= 0 THEN RAISE EXCEPTION 'Order has no invoiceable items'; END IF;
  IF ROUND(v_base_total + v_vat, 2) <> ROUND(COALESCE(v_order.total, 0), 2) THEN
    RAISE EXCEPTION 'Order totals are inconsistent; invoice was not created';
  END IF;

  FOR v_item IN SELECT * FROM order_items
    WHERE order_id = p_order_id AND COALESCE(total_price, unit_price * quantity) > 0 ORDER BY id
  LOOP
    v_component_index := v_component_index + 1;
    v_base := ROUND(COALESCE(v_item.total_price, v_item.unit_price * v_item.quantity), 2);
    v_tax := CASE WHEN v_component_index = v_component_count THEN v_vat - v_allocated_tax
      ELSE ROUND(v_vat * v_base / v_base_total, 2) END;
    v_allocated_tax := v_allocated_tax + v_tax;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'description', COALESCE(v_item.name, 'Cleaning service'), 'quantity', COALESCE(v_item.quantity, 1),
      'unit_price', COALESCE(v_item.unit_price, v_base / NULLIF(v_item.quantity, 0)),
      'discount_amount', 0, 'tax_amount', v_tax,
      'metadata', jsonb_build_object('order_item_id', v_item.id, 'item_type', v_item.item_type)));
  END LOOP;
  IF v_delivery_fee > 0 THEN
    v_component_index := v_component_index + 1;
    v_tax := v_vat - v_allocated_tax;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'description', 'Delivery fee', 'quantity', 1, 'unit_price', v_delivery_fee,
      'discount_amount', 0, 'tax_amount', v_tax,
      'metadata', jsonb_build_object('source', 'order_delivery_fee')));
  END IF;

  v_result := create_invoice_with_lines(v_contact_id, CURRENT_DATE, COALESCE(p_due_date, CURRENT_DATE + 14),
    'Order ' || v_order.tracking_code, v_lines, 'pending'::invoice_status, p_post, p_business);
  IF NOT COALESCE((v_result->>'success')::BOOLEAN, FALSE) THEN RETURN v_result; END IF;

  v_invoice_id := (v_result->>'invoice_id')::UUID;
  UPDATE invoices SET order_id = p_order_id, order_number = v_order.tracking_code,
    order_tracking_code = v_order.tracking_code,
    vat_rate = CASE WHEN v_base_total > 0 THEN ROUND(v_vat / v_base_total, 4) ELSE 0 END,
    updated_at = NOW() WHERE id = v_invoice_id;

  v_reconcile := reconcile_order_invoice_payments(p_order_id, v_invoice_id);
  RETURN v_result || jsonb_build_object('idempotent', FALSE, 'order_id', p_order_id,
    'order_number', v_order.tracking_code, 'reconciliation', v_reconcile);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_invoice_from_delivered_order(UUID, DATE, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_invoice_from_delivered_order(UUID, DATE, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_delivered_order(UUID, DATE, BOOLEAN, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_account_completed_order_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NEW.order_id IS NULL OR NEW.status::TEXT <> 'completed' THEN RETURN NEW; END IF;
  v_result := create_invoice_from_delivered_order(NEW.order_id, CURRENT_DATE + 14, TRUE, NEW.business);
  IF NOT COALESCE((v_result->>'success')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'Automatic order accounting failed: %', COALESCE(v_result->>'error', 'unknown error');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_account_completed_order_payment ON public.payments;
CREATE TRIGGER trg_auto_account_completed_order_payment
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW
  WHEN (NEW.status::TEXT = 'completed')
  EXECUTE FUNCTION public.auto_account_completed_order_payment();

REVOKE ALL ON FUNCTION public.auto_account_completed_order_payment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_account_completed_order_payment() TO service_role;
