-- Database Functions for Server-Side Aggregations
-- Created: 2026-02-17
-- Purpose: Move expensive aggregations from client to database

-- Function to get active orders count (status 1-11)
CREATE OR REPLACE FUNCTION get_active_orders_count()
RETURNS bigint AS $$
  SELECT COUNT(*)
  FROM orders
  WHERE status BETWEEN 1 AND 11;
$$ LANGUAGE sql STABLE;

-- Function to get total completed revenue
CREATE OR REPLACE FUNCTION get_total_revenue()
RETURNS numeric AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM payments
  WHERE status = 'completed';
$$ LANGUAGE sql STABLE;

-- Function to get order status counts with names
CREATE OR REPLACE FUNCTION get_order_status_counts()
RETURNS TABLE(status_name text, count bigint) AS $$
  SELECT
    CASE status
      WHEN 0 THEN 'Cancelled'
      WHEN 1 THEN 'Pending'
      WHEN 2 THEN 'Driver Assigned'
      WHEN 3 THEN 'Quote Accepted'
      WHEN 4 THEN 'Pickup Scheduled'
      WHEN 5 THEN 'Picked Up'
      WHEN 6 THEN 'In Washing'
      WHEN 7 THEN 'Drying'
      WHEN 8 THEN 'Quality Check'
      WHEN 9 THEN 'Ready'
      WHEN 10 THEN 'Dispatched'
      WHEN 11 THEN 'Out for Delivery'
      WHEN 12 THEN 'Delivered'
      ELSE 'Status ' || status::text
    END as status_name,
    COUNT(*) as count
  FROM orders
  GROUP BY status
  ORDER BY status;
$$ LANGUAGE sql STABLE;

-- Function to get sales data by date
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
    AND o.status != 0  -- Exclude cancelled orders
  GROUP BY DATE(o.created_at)
  ORDER BY date;
$$ LANGUAGE sql STABLE;

-- Function to get dashboard KPIs in one call
CREATE OR REPLACE FUNCTION get_dashboard_kpis()
RETURNS TABLE(
  total_revenue numeric,
  active_orders bigint,
  total_customers bigint
) AS $$
  SELECT
    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed') as total_revenue,
    (SELECT COUNT(*) FROM orders WHERE status BETWEEN 1 AND 11) as active_orders,
    (SELECT COUNT(*) FROM profiles WHERE role = 'customer') as total_customers;
$$ LANGUAGE sql STABLE;

-- Comments for documentation
COMMENT ON FUNCTION get_active_orders_count() IS 'Returns count of orders with status between 1 and 11';
COMMENT ON FUNCTION get_total_revenue() IS 'Returns sum of all completed payment amounts';
COMMENT ON FUNCTION get_order_status_counts() IS 'Returns order counts grouped by status with human-readable names';
COMMENT ON FUNCTION get_sales_by_date(integer) IS 'Returns sales metrics grouped by date for the specified number of days';
COMMENT ON FUNCTION get_dashboard_kpis() IS 'Returns all dashboard KPIs in a single query for optimal performance';
