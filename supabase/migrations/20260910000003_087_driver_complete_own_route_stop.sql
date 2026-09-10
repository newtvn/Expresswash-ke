-- Let a driver complete only a pending stop on one of their own routes.
-- A narrowly scoped RPC avoids granting browser roles general UPDATE access to
-- route_stops, which also contains order/customer routing data.
CREATE OR REPLACE FUNCTION public.complete_own_route_stop(p_stop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.route_stops AS stop
  SET
    status = 'completed',
    completed_time = NOW()
  WHERE stop.id = p_stop_id
    AND stop.status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.driver_routes AS route
      WHERE route.id = stop.route_id
        AND route.driver_id = auth.uid()
    )
  RETURNING TRUE INTO v_updated;

  RETURN COALESCE(v_updated, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_own_route_stop(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_own_route_stop(UUID) TO authenticated;
