-- Atomic function: records promotion usage AND increments counter in one transaction.
-- Prevents race condition where insert succeeds but counter increment fails.
CREATE OR REPLACE FUNCTION record_promotion_usage(
  p_promotion_id UUID,
  p_customer_id UUID,
  p_order_id UUID,
  p_discount_applied NUMERIC
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Insert usage record
  INSERT INTO promotion_usage (promotion_id, customer_id, order_id, discount_applied)
  VALUES (p_promotion_id, p_customer_id, p_order_id, p_discount_applied);

  -- Atomically increment times_used counter
  UPDATE promotions
  SET times_used = times_used + 1
  WHERE id = p_promotion_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_promotion_usage TO authenticated;

-- Keep the simple increment as a convenience for other callers
CREATE OR REPLACE FUNCTION increment_promotion_usage(p_promotion_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE promotions
  SET times_used = times_used + 1
  WHERE id = p_promotion_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_promotion_usage TO authenticated;
