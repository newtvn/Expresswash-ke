-- ============================================================
-- Delivery metrics: avg time to delivery + on-time rate
-- Computed from orders table (created_at, updated_at, sla_deadline)
-- ============================================================

CREATE OR REPLACE FUNCTION get_delivery_metrics()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  PERFORM _assert_admin();

  SELECT jsonb_build_object(
    'avg_days', (
      SELECT COALESCE(
        ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)::NUMERIC, 1),
        0
      )
      FROM orders
      WHERE status = 12
    ),
    'delivered_total', (
      SELECT COUNT(*) FROM orders WHERE status = 12
    ),
    'on_time_count', (
      SELECT COUNT(*)
      FROM orders
      WHERE status = 12
        AND sla_deadline IS NOT NULL
        AND updated_at <= sla_deadline
    ),
    'with_sla_count', (
      SELECT COUNT(*)
      FROM orders
      WHERE status = 12
        AND sla_deadline IS NOT NULL
    ),
    'on_time_rate', (
      SELECT CASE
        WHEN COUNT(*) FILTER (WHERE sla_deadline IS NOT NULL) > 0
        THEN ROUND(
          COUNT(*) FILTER (WHERE sla_deadline IS NOT NULL AND updated_at <= sla_deadline)::NUMERIC
          / COUNT(*) FILTER (WHERE sla_deadline IS NOT NULL) * 100,
          0
        )
        ELSE 100
      END
      FROM orders
      WHERE status = 12
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_delivery_metrics() TO authenticated;
