-- Atomically dispatch a warehouse order and create the driver's delivery stop.
-- Direct browser writes cannot create driver routes/stops because those tables are
-- intentionally admin-managed, so expose one narrowly scoped warehouse RPC.

CREATE OR REPLACE FUNCTION public.dispatch_warehouse_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_route_id UUID;
  v_sort_order INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_warehouse_staff() THEN
    RAISE EXCEPTION 'Warehouse staff access required' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.status <> 9 THEN
    RAISE EXCEPTION 'Order must be ready for dispatch' USING ERRCODE = '22023';
  END IF;

  IF v_order.driver_id IS NULL THEN
    RAISE EXCEPTION 'Assign a driver before dispatching' USING ERRCODE = '22023';
  END IF;

  UPDATE public.warehouse_dispatch
  SET scheduled_delivery = now(),
      assigned_driver = COALESCE(v_order.driver_name, assigned_driver)
  WHERE order_id = p_order_id;

  IF NOT FOUND THEN
    INSERT INTO public.warehouse_dispatch (
      order_id,
      order_number,
      customer_name,
      zone,
      items,
      total_items,
      ready_since,
      assigned_driver,
      scheduled_delivery
    )
    SELECT
      v_order.id,
      v_order.tracking_code,
      v_order.customer_name,
      v_order.zone,
      array_agg(format('%s x%s', wp.item_name, wp.quantity) ORDER BY wp.item_name),
      sum(wp.quantity)::INTEGER,
      now(),
      v_order.driver_name,
      now()
    FROM public.warehouse_processing AS wp
    WHERE wp.order_id = v_order.id
    GROUP BY v_order.id, v_order.tracking_code, v_order.customer_name,
             v_order.zone, v_order.driver_name;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No warehouse processing record found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  SELECT route.id
  INTO v_route_id
  FROM public.driver_routes AS route
  WHERE route.driver_id = v_order.driver_id
    AND route.date = current_date::TEXT
  ORDER BY route.created_at, route.id
  LIMIT 1;

  IF v_route_id IS NULL THEN
    INSERT INTO public.driver_routes (driver_id, date, zone, status)
    VALUES (v_order.driver_id, current_date::TEXT, v_order.zone, 'planned')
    RETURNING id INTO v_route_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.route_stops AS stop
    JOIN public.driver_routes AS route ON route.id = stop.route_id
    WHERE stop.order_id = v_order.id::TEXT
      AND stop.type = 'delivery'
      AND route.driver_id = v_order.driver_id
  ) THEN
    SELECT count(*)::INTEGER
    INTO v_sort_order
    FROM public.route_stops
    WHERE route_id = v_route_id;

    INSERT INTO public.route_stops (
      route_id,
      order_id,
      customer_name,
      address,
      type,
      scheduled_time,
      status,
      sort_order
    )
    VALUES (
      v_route_id,
      v_order.id::TEXT,
      v_order.customer_name,
      COALESCE(v_order.pickup_address, ''),
      'delivery',
      now()::TEXT,
      'pending',
      v_sort_order
    );
  END IF;

  UPDATE public.orders
  SET status = 10,
      updated_at = now()
  WHERE id = v_order.id
    AND status = 9;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order status changed before dispatch' USING ERRCODE = '40001';
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_warehouse_order(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_warehouse_order(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.dispatch_warehouse_order(UUID) TO authenticated;

