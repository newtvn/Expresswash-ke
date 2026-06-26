-- ============================================================
-- Fix: Column name bugs in report functions
-- Problem: get_revenue_report uses p.payment_method (should be p.method)
--          get_driver_performance_report uses pay.payment_method (should be pay.method)
--          get_financial_report and get_dashboard_kpis use i.total_amount (should be i.total)
-- ============================================================

-- Fix get_revenue_report: p.payment_method -> p.method
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
          COALESCE(p.method::TEXT, 'unknown') AS method,
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


-- Fix get_driver_performance_report: pay.payment_method -> pay.method
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
      COALESCE(SUM(pay.amount) FILTER (WHERE pay.method = 'cash' AND pay.status = 'completed'), 0) AS cash_collected,
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

GRANT EXECUTE ON FUNCTION get_driver_performance_report(DATE, DATE) TO authenticated;


-- Fix get_financial_report: i.total_amount -> i.total
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
      SELECT COALESCE(SUM(i.total - COALESCE(paid.total_paid, 0)), 0)
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


-- Fix get_dashboard_kpis: i.total_amount -> i.total
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
      SELECT COALESCE(SUM(i.total - COALESCE(paid.total_paid, 0)), 0)
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

GRANT EXECUTE ON FUNCTION get_revenue_report(DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_financial_report(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_kpis() TO authenticated;
