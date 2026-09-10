-- Advance a driver's own delivery stop and its order in one transaction.
-- The current order stage is part of the update predicate, providing duplicate
-- and out-of-order protection without granting browser roles table-wide writes.

CREATE OR REPLACE FUNCTION public.transition_own_delivery_stop(
  p_stop_id UUID,
  p_target_status INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_stop public.route_stops%ROWTYPE;
  v_order public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT stop.*
  INTO v_stop
  FROM public.route_stops AS stop
  JOIN public.driver_routes AS route ON route.id = stop.route_id
  WHERE stop.id = p_stop_id
    AND stop.type = 'delivery'
    AND stop.status = 'pending'
    AND route.driver_id = auth.uid()
  FOR UPDATE OF stop;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  SELECT order_row.*
  INTO v_order
  FROM public.orders AS order_row
  WHERE order_row.id::TEXT = v_stop.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF p_target_status = 11 THEN
    IF v_order.status <> 10 THEN
      RETURN FALSE;
    END IF;

    UPDATE public.orders
    SET status = 11,
        updated_at = now()
    WHERE id = v_order.id
      AND status = 10;
  ELSIF p_target_status = 12 THEN
    IF v_order.status <> 11 THEN
      RETURN FALSE;
    END IF;

    UPDATE public.orders
    SET status = 12,
        updated_at = now()
    WHERE id = v_order.id
      AND status = 11;

    UPDATE public.route_stops
    SET status = 'completed',
        completed_time = now()::TEXT
    WHERE id = v_stop.id
      AND status = 'pending';

    UPDATE public.driver_routes AS route
    SET status = 'completed'
    WHERE route.id = v_stop.route_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.route_stops AS remaining
        WHERE remaining.route_id = route.id
          AND remaining.status = 'pending'
      );
  ELSE
    RAISE EXCEPTION 'Target status must be 11 or 12' USING ERRCODE = '22023';
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_own_delivery_stop(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_own_delivery_stop(UUID, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.transition_own_delivery_stop(UUID, INTEGER) TO authenticated;
