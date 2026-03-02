-- ============================================================
-- WK4: Report aggregation functions
-- Replaces static/seed report data with real DB queries
--
-- SECURITY: All functions use SECURITY DEFINER to bypass RLS
-- for aggregation, but include an explicit admin role check
-- so only admin/super_admin users can invoke them.
-- ============================================================

-- Helper: reusable admin check (raises exception if not admin)
CREATE OR REPLACE FUNCTION _assert_admin()
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 1. REVENUE REPORT
-- Returns: {summary, by_period[], by_payment_method[], by_zone[]}
CREATE OR REPLACE FUNCTION get_revenue_report(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE,
  p_granularity TEXT DEFAULT 'day'
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  trunc_fmt TEXT;
BEGIN
  PERFORM _assert_admin();

  trunc_fmt := CASE p_granularity
    WHEN 'week' THEN 'week'
    WHEN 'month' THEN 'month'
    ELSE 'day'
  END;

  SELECT jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'total_revenue', COALESCE(SUM(amount), 0),
        'total_payments', COUNT(*),
        'avg_payment', COALESCE(AVG(amount), 0)
      )
      FROM payments
      WHERE status = 'completed'
        AND created_at::DATE BETWEEN p_start_date AND p_end_date
    ),
    'by_period', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::JSONB ORDER BY t.period)
      FROM (
        SELECT
          date_trunc(trunc_fmt, p.created_at)::DATE AS period,
          COUNT(*) AS payments,
          COALESCE(SUM(p.amount), 0) AS revenue
        FROM payments p
        WHERE p.status = 'completed'
          AND p.created_at::DATE BETWEEN p_start_date AND p_end_date
        GROUP BY 1
      ) t
    ), '[]'::JSONB),
    'by_payment_method', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::JSONB)
      FROM (
        SELECT
          COALESCE(p.payment_method, 'unknown') AS method,
          COUNT(*) AS count,
          COALESCE(SUM(p.amount), 0) AS revenue
        FROM payments p
        WHERE p.status = 'completed'
          AND p.created_at::DATE BETWEEN p_start_date AND p_end_date
        GROUP BY 1
        ORDER BY revenue DESC
      ) t
    ), '[]'::JSONB),
    'by_zone', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::JSONB)
      FROM (
        SELECT
          COALESCE(o.zone, 'Unknown') AS zone,
          COUNT(DISTINCT o.id) AS orders,
          COALESCE(SUM(p.amount), 0) AS revenue
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        WHERE p.status = 'completed'
          AND p.created_at::DATE BETWEEN p_start_date AND p_end_date
        GROUP BY 1
        ORDER BY revenue DESC
      ) t
    ), '[]'::JSONB)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 2. ORDER REPORT
-- Returns: {status_breakdown[], daily_orders[], totals, sla_compliance}
CREATE OR REPLACE FUNCTION get_order_report(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  PERFORM _assert_admin();

  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'total_orders', COUNT(*),
        'completed', COUNT(*) FILTER (WHERE status = 12),
        'cancelled', COUNT(*) FILTER (WHERE status = 13),
        'in_progress', COUNT(*) FILTER (WHERE status BETWEEN 1 AND 11)
      )
      FROM orders
      WHERE created_at::DATE BETWEEN p_start_date AND p_end_date
    ),
    'status_breakdown', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::JSONB)
      FROM (
        SELECT
          status,
          CASE status
            WHEN 1 THEN 'Pending'
            WHEN 2 THEN 'Confirmed'
            WHEN 3 THEN 'Driver Assigned'
            WHEN 4 THEN 'Pickup Scheduled'
            WHEN 5 THEN 'Picked Up'
            WHEN 6 THEN 'In Processing'
            WHEN 7 THEN 'Processing Complete'
            WHEN 8 THEN 'Quality Check'
            WHEN 9 THEN 'Quality Approved'
            WHEN 10 THEN 'Ready for Delivery'
            WHEN 11 THEN 'Out for Delivery'
            WHEN 12 THEN 'Delivered'
            WHEN 13 THEN 'Cancelled'
            WHEN 14 THEN 'Refunded'
            ELSE 'Unknown'
          END AS status_name,
          COUNT(*) AS count
        FROM orders
        WHERE created_at::DATE BETWEEN p_start_date AND p_end_date
        GROUP BY 1
        ORDER BY 1
      ) t
    ), '[]'::JSONB),
    'daily_orders', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::JSONB ORDER BY t.date)
      FROM (
        SELECT
          created_at::DATE AS date,
          COUNT(*) AS orders,
          COUNT(*) FILTER (WHERE status = 12) AS completed,
          COUNT(*) FILTER (WHERE status = 13) AS cancelled
        FROM orders
        WHERE created_at::DATE BETWEEN p_start_date AND p_end_date
        GROUP BY 1
      ) t
    ), '[]'::JSONB),
    'sla_compliance', (
      SELECT jsonb_build_object(
        'total_with_sla', COUNT(*) FILTER (WHERE sla_deadline IS NOT NULL),
        'met_sla', COUNT(*) FILTER (
          WHERE sla_deadline IS NOT NULL
            AND status = 12
            AND updated_at <= sla_deadline
        ),
        'breached_sla', COUNT(*) FILTER (
          WHERE sla_deadline IS NOT NULL
            AND status NOT IN (13, 14)
            AND (
              (status = 12 AND updated_at > sla_deadline)
              OR (status BETWEEN 1 AND 11 AND NOW() > sla_deadline)
            )
        )
      )
      FROM orders
      WHERE created_at::DATE BETWEEN p_start_date AND p_end_date
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 3. DRIVER PERFORMANCE REPORT
-- Returns JSONB array of per-driver metrics
CREATE OR REPLACE FUNCTION get_driver_performance_report(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  PERFORM _assert_admin();

  SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB), '[]'::JSONB)
  FROM (
    SELECT
      p.id AS driver_id,
      p.name,
      COUNT(o.id) FILTER (WHERE o.status = 12) AS deliveries,
      COUNT(o.id) FILTER (WHERE o.status >= 5 AND o.status <> 13) AS pickups,
      ROUND(COALESCE(AVG(r.overall_rating), 0), 1) AS avg_rating,
      COALESCE(SUM(pay.amount) FILTER (WHERE pay.payment_method = 'cash' AND pay.status = 'completed'), 0) AS cash_collected,
      CASE
        WHEN COUNT(o.id) > 0
        THEN ROUND(COUNT(o.id) FILTER (WHERE o.status = 13)::NUMERIC / COUNT(o.id) * 100, 1)
        ELSE 0
      END AS cancellation_rate,
      COUNT(o.id) AS total_orders
    FROM profiles p
    LEFT JOIN orders o ON o.driver_id = p.id
      AND o.created_at::DATE BETWEEN p_start_date AND p_end_date
    LEFT JOIN reviews r ON r.driver_id = p.id
      AND r.created_at::DATE BETWEEN p_start_date AND p_end_date
      AND r.status = 'approved'
    LEFT JOIN payments pay ON pay.order_id = o.id
    WHERE p.role = 'driver'
    GROUP BY p.id, p.name
    ORDER BY deliveries DESC
  ) t INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 4. CUSTOMER REPORT
-- Returns: {total_customers, new_customers_period, tier_distribution[], top_customers[], zone_distribution[], avg_review_rating}
CREATE OR REPLACE FUNCTION get_customer_report(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  PERFORM _assert_admin();

  SELECT jsonb_build_object(
    'total_customers', (
      SELECT COUNT(*) FROM profiles WHERE role = 'customer'
    ),
    'new_customers_period', (
      SELECT COUNT(*) FROM profiles
      WHERE role = 'customer'
        AND created_at::DATE BETWEEN p_start_date AND p_end_date
    ),
    'tier_distribution', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::JSONB)
      FROM (
        SELECT
          COALESCE(la.tier, 'bronze') AS tier,
          COUNT(*) AS count
        FROM profiles p
        LEFT JOIN loyalty_accounts la ON la.customer_id = p.id
        WHERE p.role = 'customer'
        GROUP BY 1
        ORDER BY
          CASE COALESCE(la.tier, 'bronze')
            WHEN 'bronze' THEN 1
            WHEN 'silver' THEN 2
            WHEN 'gold' THEN 3
            WHEN 'platinum' THEN 4
            ELSE 5
          END
      ) t
    ), '[]'::JSONB),
    'top_customers', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::JSONB)
      FROM (
        SELECT
          p.name,
          COUNT(o.id) AS order_count,
          COALESCE(SUM(o.total), 0) AS total_spent
        FROM profiles p
        JOIN orders o ON o.customer_id = p.id
        WHERE p.role = 'customer'
          AND o.created_at::DATE BETWEEN p_start_date AND p_end_date
          AND o.status NOT IN (13, 14)
        GROUP BY p.id, p.name
        ORDER BY total_spent DESC
        LIMIT 20
      ) t
    ), '[]'::JSONB),
    'zone_distribution', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::JSONB)
      FROM (
        SELECT
          COALESCE(p.zone, 'Unknown') AS zone,
          COUNT(*) AS count
        FROM profiles p
        WHERE p.role = 'customer'
        GROUP BY 1
        ORDER BY count DESC
      ) t
    ), '[]'::JSONB),
    'avg_review_rating', (
      SELECT COALESCE(ROUND(AVG(overall_rating), 1), 0)
      FROM reviews
      WHERE status = 'approved'
        AND created_at::DATE BETWEEN p_start_date AND p_end_date
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 5. FINANCIAL REPORT
-- Returns: {total_revenue, total_expenses, gross_profit, profit_margin, expenses_by_category[], outstanding_receivables, overdue_count}
CREATE OR REPLACE FUNCTION get_financial_report(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  v_revenue NUMERIC;
  v_expenses NUMERIC;
  result JSONB;
BEGIN
  PERFORM _assert_admin();

  SELECT COALESCE(SUM(amount), 0) INTO v_revenue
  FROM payments
  WHERE status = 'completed'
    AND created_at::DATE BETWEEN p_start_date AND p_end_date;

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM expenses
  WHERE status = 'approved'
    AND expense_date BETWEEN p_start_date AND p_end_date;

  SELECT jsonb_build_object(
    'total_revenue', v_revenue,
    'total_expenses', v_expenses,
    'gross_profit', v_revenue - v_expenses,
    'profit_margin', CASE
      WHEN v_revenue > 0 THEN ROUND(((v_revenue - v_expenses) / v_revenue) * 100, 1)
      ELSE 0
    END,
    'expenses_by_category', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::JSONB)
      FROM (
        SELECT
          category,
          SUM(amount) AS total,
          COUNT(*) AS count
        FROM expenses
        WHERE status = 'approved'
          AND expense_date BETWEEN p_start_date AND p_end_date
        GROUP BY category
        ORDER BY total DESC
      ) t
    ), '[]'::JSONB),
    'outstanding_receivables', (
      SELECT COALESCE(SUM(i.total_amount - COALESCE(paid.total_paid, 0)), 0)
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS total_paid
        FROM payments
        WHERE status = 'completed'
        GROUP BY invoice_id
      ) paid ON paid.invoice_id = i.id
      WHERE i.status IN ('sent', 'overdue', 'partially_paid')
    ),
    'overdue_count', (
      SELECT COUNT(*)
      FROM invoices
      WHERE status = 'overdue'
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 6. ENHANCED DASHBOARD KPIs (replaces old TABLE-returning version)
-- NOTE: Also admin-only since it exposes revenue/financial data.
-- For a future public KPI endpoint, create a separate limited function.
DROP FUNCTION IF EXISTS get_dashboard_kpis();

CREATE OR REPLACE FUNCTION get_dashboard_kpis()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  PERFORM _assert_admin();

  SELECT jsonb_build_object(
    'orders_today', (
      SELECT COUNT(*) FROM orders WHERE created_at::DATE = CURRENT_DATE
    ),
    'orders_pending', (
      SELECT COUNT(*) FROM orders WHERE status = 1
    ),
    'orders_in_progress', (
      SELECT COUNT(*) FROM orders WHERE status BETWEEN 2 AND 11
    ),
    'revenue_today', (
      SELECT COALESCE(SUM(amount), 0) FROM payments
      WHERE status = 'completed' AND created_at::DATE = CURRENT_DATE
    ),
    'revenue_this_month', (
      SELECT COALESCE(SUM(amount), 0) FROM payments
      WHERE status = 'completed'
        AND created_at >= date_trunc('month', CURRENT_DATE)
    ),
    'total_revenue', (
      SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed'
    ),
    'unpaid_invoices', (
      SELECT COUNT(*) FROM invoices WHERE status IN ('sent', 'overdue', 'partially_paid')
    ),
    'outstanding_amount', (
      SELECT COALESCE(SUM(i.total_amount - COALESCE(paid.total_paid, 0)), 0)
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS total_paid
        FROM payments
        WHERE status = 'completed'
        GROUP BY invoice_id
      ) paid ON paid.invoice_id = i.id
      WHERE i.status IN ('sent', 'overdue', 'partially_paid')
    ),
    'active_drivers', (
      SELECT COUNT(*) FROM profiles WHERE role = 'driver'
    ),
    'total_customers', (
      SELECT COUNT(*) FROM profiles WHERE role = 'customer'
    ),
    'avg_rating', (
      SELECT COALESCE(ROUND(AVG(overall_rating), 1), 0)
      FROM reviews WHERE status = 'approved'
    ),
    'sla_breaches_today', (
      SELECT COUNT(*) FROM orders
      WHERE sla_deadline IS NOT NULL
        AND sla_deadline::DATE = CURRENT_DATE
        AND status BETWEEN 1 AND 11
        AND NOW() > sla_deadline
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- Grant execute to authenticated users (functions self-enforce admin role internally)
GRANT EXECUTE ON FUNCTION _assert_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_revenue_report(DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_report(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_performance_report(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_report(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_financial_report(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_kpis() TO authenticated;
