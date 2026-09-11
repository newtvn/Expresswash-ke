-- Temporary, tightly-scoped production canary for the minimum PesaPal amount.
-- This does not weaken normal order pricing. Migration 096 removes this RPC
-- after the payment/refund verification while retaining the financial records.

CREATE OR REPLACE FUNCTION public.create_pesapal_qa_order_10(p_customer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_order orders%ROWTYPE;
  v_tracking_code CONSTANT TEXT := 'EW-QA-PESAPAL-10-20260911';
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only an administrator or trusted service may create the QA canary order'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'A customer is required';
  END IF;

  -- Serialise replays and always return the single fixed canary.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tracking_code, 0));
  SELECT * INTO v_order FROM orders WHERE tracking_code = v_tracking_code;
  IF FOUND THEN
    IF v_order.customer_id IS DISTINCT FROM p_customer_id THEN
      RAISE EXCEPTION 'The QA canary already belongs to another customer';
    END IF;
    RETURN jsonb_build_object(
      'success', TRUE,
      'idempotent', TRUE,
      'order_id', v_order.id,
      'tracking_code', v_order.tracking_code,
      'total', v_order.total
    );
  END IF;

  SELECT * INTO v_profile
  FROM profiles
  WHERE id = p_customer_id AND role = 'customer';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active customer profile not found';
  END IF;

  INSERT INTO orders (
    tracking_code, customer_id, customer_name, status, pickup_date,
    estimated_delivery, zone, pickup_address, notes, priority,
    subtotal, delivery_fee, vat, total, payment_status, payment_method
  ) VALUES (
    v_tracking_code, v_profile.id, v_profile.name, 2,
    CURRENT_DATE::TEXT, CURRENT_DATE::TEXT, 'QA ONLY',
    'QA ONLY - NO PHYSICAL PICKUP',
    'QA ONLY - KES 10 PesaPal payment/refund verification; do not dispatch or fulfil.',
    'normal', 8.62, 0.00, 1.38, 10.00, 'unpaid', 'mpesa'
  ) RETURNING * INTO v_order;

  INSERT INTO order_items (
    order_id, name, quantity, item_type, unit_price, total_price
  ) VALUES (
    v_order.id, 'QA-only payment canary', 1, 'qa_canary', 8.62, 8.62
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'idempotent', FALSE,
    'order_id', v_order.id,
    'tracking_code', v_order.tracking_code,
    'total', v_order.total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_pesapal_qa_order_10(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pesapal_qa_order_10(UUID) TO authenticated, service_role;

