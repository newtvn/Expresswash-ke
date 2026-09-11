-- Create a canonical, itemized invoice from a delivered operational order.
-- The RPC is admin-only, links the invoice back to the order, and is idempotent.

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
    RAISE EXCEPTION 'Only admins can create order invoices';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order is required';
  END IF;

  -- Serialize creation per order so concurrent clicks cannot create duplicates.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::TEXT, 0));

  SELECT * INTO v_existing
  FROM invoices
  WHERE order_id = p_order_id
    AND status::TEXT <> 'cancelled'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'idempotent', TRUE,
      'invoice_id', v_existing.id,
      'invoice_number', v_existing.invoice_number
    );
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status <> 12 THEN
    RAISE EXCEPTION 'Only delivered orders can be invoiced';
  END IF;

  SELECT email, phone INTO v_profile
  FROM profiles
  WHERE id = v_order.customer_id;

  v_contact_id := accounting_contact_for_profile(
    v_order.customer_id,
    v_order.customer_name,
    COALESCE(v_order.customer_phone, v_profile.phone),
    v_profile.email
  );

  IF v_contact_id IS NULL THEN
    RAISE EXCEPTION 'Order customer could not be linked to an accounting contact';
  END IF;

  v_delivery_fee := ROUND(COALESCE(v_order.delivery_fee, 0), 2);
  v_vat := ROUND(COALESCE(v_order.vat, 0), 2);

  SELECT
    COUNT(*)::INTEGER,
    ROUND(COALESCE(SUM(COALESCE(total_price, unit_price * quantity)), 0), 2)
  INTO v_component_count, v_base_total
  FROM order_items
  WHERE order_id = p_order_id
    AND COALESCE(total_price, unit_price * quantity) > 0;

  IF v_delivery_fee > 0 THEN
    v_component_count := v_component_count + 1;
    v_base_total := v_base_total + v_delivery_fee;
  END IF;

  IF v_component_count = 0 OR v_base_total <= 0 THEN
    RAISE EXCEPTION 'Order has no invoiceable items';
  END IF;

  IF ROUND(v_base_total + v_vat, 2) <> ROUND(COALESCE(v_order.total, 0), 2) THEN
    RAISE EXCEPTION 'Order totals are inconsistent; invoice was not created';
  END IF;

  FOR v_item IN
    SELECT *
    FROM order_items
    WHERE order_id = p_order_id
      AND COALESCE(total_price, unit_price * quantity) > 0
    ORDER BY id
  LOOP
    v_component_index := v_component_index + 1;
    v_base := ROUND(COALESCE(v_item.total_price, v_item.unit_price * v_item.quantity), 2);
    v_tax := CASE
      WHEN v_component_index = v_component_count THEN v_vat - v_allocated_tax
      ELSE ROUND(v_vat * v_base / v_base_total, 2)
    END;
    v_allocated_tax := v_allocated_tax + v_tax;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'description', COALESCE(v_item.name, 'Cleaning service'),
      'quantity', COALESCE(v_item.quantity, 1),
      'unit_price', COALESCE(v_item.unit_price, v_base / NULLIF(v_item.quantity, 0)),
      'discount_amount', 0,
      'tax_amount', v_tax,
      'metadata', jsonb_build_object('order_item_id', v_item.id, 'item_type', v_item.item_type)
    ));
  END LOOP;

  IF v_delivery_fee > 0 THEN
    v_component_index := v_component_index + 1;
    v_tax := v_vat - v_allocated_tax;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'description', 'Delivery fee',
      'quantity', 1,
      'unit_price', v_delivery_fee,
      'discount_amount', 0,
      'tax_amount', v_tax,
      'metadata', jsonb_build_object('source', 'order_delivery_fee')
    ));
  END IF;

  v_result := create_invoice_with_lines(
    v_contact_id,
    CURRENT_DATE,
    COALESCE(p_due_date, CURRENT_DATE + 14),
    'Order ' || v_order.tracking_code,
    v_lines,
    'pending'::invoice_status,
    p_post,
    p_business
  );

  IF NOT COALESCE((v_result->>'success')::BOOLEAN, FALSE) THEN
    RETURN v_result;
  END IF;

  v_invoice_id := (v_result->>'invoice_id')::UUID;
  UPDATE invoices
  SET order_id = p_order_id,
      order_number = v_order.tracking_code,
      order_tracking_code = v_order.tracking_code,
      vat_rate = CASE WHEN v_base_total > 0 THEN ROUND(v_vat / v_base_total, 4) ELSE 0 END,
      updated_at = NOW()
  WHERE id = v_invoice_id;

  RETURN v_result || jsonb_build_object(
    'idempotent', FALSE,
    'order_id', p_order_id,
    'order_number', v_order.tracking_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_invoice_from_delivered_order(UUID, DATE, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_invoice_from_delivered_order(UUID, DATE, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_delivered_order(UUID, DATE, BOOLEAN, TEXT) TO authenticated, service_role;
