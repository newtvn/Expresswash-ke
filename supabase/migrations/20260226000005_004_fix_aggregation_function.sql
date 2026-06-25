-- ============================================================
-- Migration: Fix get_order_status_counts() to match 14-stage pipeline
--
-- The existing function (20260217_add_aggregation_functions.sql)
-- maps statuses as: 0=Cancelled, 2=Driver Assigned, 3=Quote Accepted, etc.
-- The actual frontend uses: 1=Pending, 2=Confirmed, 3=Driver Assigned, etc.
-- (See src/constants/orderStatus.ts for the authoritative mapping.)
--
-- Also fix get_sales_by_date to exclude cancelled (13) and
-- refunded (14) instead of status 0.
-- Note: get_dashboard_kpis already uses BETWEEN 1 AND 11, which
-- correctly excludes delivered/cancelled/refunded — no change needed.
-- ============================================================

CREATE OR REPLACE FUNCTION get_order_status_counts()
RETURNS TABLE(status_name text, count bigint) AS $$
  SELECT
    CASE status
      WHEN 1  THEN 'Pending'
      WHEN 2  THEN 'Confirmed'
      WHEN 3  THEN 'Driver Assigned'
      WHEN 4  THEN 'Pickup Scheduled'
      WHEN 5  THEN 'Picked Up'
      WHEN 6  THEN 'In Processing'
      WHEN 7  THEN 'Processing Complete'
      WHEN 8  THEN 'Quality Check'
      WHEN 9  THEN 'Quality Approved'
      WHEN 10 THEN 'Ready for Delivery'
      WHEN 11 THEN 'Out for Delivery'
      WHEN 12 THEN 'Delivered'
      WHEN 13 THEN 'Cancelled'
      WHEN 14 THEN 'Refunded'
      ELSE 'Status ' || status::text
    END as status_name,
    COUNT(*) as count
  FROM orders
  GROUP BY status
  ORDER BY status;
$$ LANGUAGE sql STABLE;

-- Fix get_sales_by_date to exclude status 13/14 instead of 0
CREATE OR REPLACE FUNCTION get_sales_by_date(days_back integer DEFAULT 30)
RETURNS TABLE(
  date date,
  orders bigint,
  revenue numeric,
  avg_order_value numeric
) AS $$
  SELECT
    DATE(o.created_at) as date,
    COUNT(*) as orders,
    COALESCE(SUM(o.total), 0) as revenue,
    COALESCE(AVG(o.total), 0) as avg_order_value
  FROM orders o
  WHERE o.created_at >= NOW() - (days_back || ' days')::interval
    AND o.status NOT IN (13, 14)
  GROUP BY DATE(o.created_at)
  ORDER BY date;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_order_status_counts() IS 'Returns order counts grouped by the 14-stage status pipeline with human-readable names';
