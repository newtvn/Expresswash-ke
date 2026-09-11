-- Complete the efficiency audit: database-side summaries and composite indexes
-- for the remaining server-paginated operational lists.

CREATE INDEX IF NOT EXISTS idx_payments_recorded_by_created_at
  ON public.payments(recorded_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_created_at
  ON public.reviews(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_business_date
  ON public.expenses(business, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_business_status
  ON public.expenses(business, status);
CREATE INDEX IF NOT EXISTS idx_contacts_active_name
  ON public.contacts(active, name);
CREATE INDEX IF NOT EXISTS idx_invoices_business_status_created
  ON public.invoices(business, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_order_stats()
RETURNS TABLE (
  total BIGINT,
  pending BIGINT,
  in_progress BIGINT,
  delivered BIGINT,
  cancelled BIGINT,
  by_status JSONB
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH counts AS (
    SELECT status, COUNT(*)::BIGINT AS count
    FROM public.orders
    GROUP BY status
  )
  SELECT
    COALESCE(SUM(count), 0)::BIGINT,
    COALESCE(SUM(count) FILTER (WHERE status = 1), 0)::BIGINT,
    COALESCE(SUM(count) FILTER (WHERE status BETWEEN 2 AND 11), 0)::BIGINT,
    COALESCE(SUM(count) FILTER (WHERE status = 12), 0)::BIGINT,
    COALESCE(SUM(count) FILTER (WHERE status = 13), 0)::BIGINT,
    COALESCE(jsonb_object_agg(status::TEXT, count), '{}'::JSONB)
  FROM counts;
$$;

CREATE OR REPLACE FUNCTION public.get_review_stats()
RETURNS TABLE (
  average_rating NUMERIC,
  total_reviews BIGINT,
  pending_count BIGINT,
  this_month_count BIGINT
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    COALESCE(ROUND(AVG(overall_rating)::NUMERIC, 1), 0),
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT,
    COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP))::BIGINT
  FROM public.reviews;
$$;

CREATE OR REPLACE FUNCTION public.get_expense_summary(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_business TEXT DEFAULT NULL
)
RETURNS TABLE (
  category TEXT,
  total NUMERIC,
  count BIGINT,
  percentage NUMERIC
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH grouped AS (
    SELECT e.category, SUM(e.amount)::NUMERIC AS total, COUNT(*)::BIGINT AS count
    FROM public.expenses e
    WHERE e.status = 'approved'
      AND e.posted_journal_entry_id IS NOT NULL
      AND (p_from IS NULL OR e.expense_date >= p_from)
      AND (p_to IS NULL OR e.expense_date <= p_to)
      AND (p_business IS NULL OR p_business = 'all' OR e.business = p_business)
    GROUP BY e.category
  ), totals AS (
    SELECT COALESCE(SUM(grouped.total), 0) AS grand_total FROM grouped
  )
  SELECT
    grouped.category,
    grouped.total,
    grouped.count,
    CASE WHEN totals.grand_total > 0
      THEN ROUND(grouped.total / totals.grand_total * 100, 1)
      ELSE 0
    END
  FROM grouped CROSS JOIN totals
  ORDER BY grouped.total DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_billing_summary(p_customer_id UUID)
RETURNS TABLE (
  paid_this_month NUMERIC,
  outstanding NUMERIC,
  total_paid NUMERIC
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    COALESCE((
      SELECT SUM(p.amount)
      FROM public.payments p
      WHERE p.customer_id = p_customer_id
        AND p.status = 'completed'
        AND p.created_at >= date_trunc('month', CURRENT_TIMESTAMP)
    ), 0),
    COALESCE((
      SELECT SUM(GREATEST(COALESCE(i.balance, i.total - COALESCE(i.paid_amount, 0)), 0))
      FROM public.invoices i
      WHERE i.customer_id = p_customer_id
        AND i.status NOT IN ('paid', 'cancelled')
    ), 0),
    COALESCE((
      SELECT SUM(p.amount)
      FROM public.payments p
      WHERE p.customer_id = p_customer_id AND p.status = 'completed'
    ), 0);
$$;

CREATE OR REPLACE FUNCTION public.get_billing_financial_summary(p_business TEXT DEFAULT NULL)
RETURNS TABLE (
  total_count BIGINT,
  pending_count BIGINT,
  paid_count BIGINT,
  overdue_count BIGINT,
  total_invoiced NUMERIC,
  received_total NUMERIC,
  outstanding_total NUMERIC,
  overdue_total NUMERIC
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH annotated AS (
    SELECT i.*,
      i.balance > 0
      AND i.status IN ('sent', 'pending', 'partial', 'partially_paid', 'overdue')
      AND (
        i.status = 'overdue'
        OR CASE
          WHEN i.due_at IS NOT NULL THEN (i.due_at AT TIME ZONE 'Africa/Nairobi')::DATE
          WHEN i.due_date ~ '^\d{4}-\d{2}-\d{2}$' THEN i.due_date::DATE
          ELSE NULL
        END < timezone('Africa/Nairobi', CURRENT_TIMESTAMP)::DATE
      ) AS is_overdue
    FROM public.invoices i
    WHERE p_business IS NULL OR p_business = 'all' OR i.business = p_business
  )
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (
      WHERE status IN ('draft', 'pending', 'sent', 'partial', 'partially_paid')
        AND NOT is_overdue
    )::BIGINT,
    COUNT(*) FILTER (WHERE status = 'paid')::BIGINT,
    COUNT(*) FILTER (WHERE is_overdue)::BIGINT,
    COALESCE(SUM(total) FILTER (
      WHERE status IN ('sent', 'pending', 'paid', 'partial', 'partially_paid', 'overdue')
    ), 0)::NUMERIC,
    COALESCE(SUM(paid_amount) FILTER (
      WHERE status IN ('sent', 'pending', 'paid', 'partial', 'partially_paid', 'overdue')
    ), 0)::NUMERIC,
    COALESCE(SUM(balance) FILTER (
      WHERE status IN ('sent', 'pending', 'partial', 'partially_paid', 'overdue') AND balance > 0
    ), 0)::NUMERIC,
    COALESCE(SUM(balance) FILTER (WHERE is_overdue), 0)::NUMERIC
  FROM annotated;
$$;

CREATE OR REPLACE FUNCTION public.get_billing_invoices_page(
  p_business TEXT DEFAULT NULL,
  p_view TEXT DEFAULT 'all',
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 20,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH annotated AS (
    SELECT i.*,
      i.balance > 0
      AND i.status IN ('sent', 'pending', 'partial', 'partially_paid', 'overdue')
      AND (
        i.status = 'overdue'
        OR CASE
          WHEN i.due_at IS NOT NULL THEN (i.due_at AT TIME ZONE 'Africa/Nairobi')::DATE
          WHEN i.due_date ~ '^\d{4}-\d{2}-\d{2}$' THEN i.due_date::DATE
          ELSE NULL
        END < timezone('Africa/Nairobi', CURRENT_TIMESTAMP)::DATE
      ) AS is_overdue
    FROM public.invoices i
    WHERE p_business IS NULL OR p_business = 'all' OR i.business = p_business
  ), filtered AS (
    SELECT * FROM annotated i
    WHERE (
      p_view = 'all'
      OR (p_view = 'paid' AND i.status = 'paid')
      OR (p_view = 'overdue' AND i.is_overdue)
      OR (p_view = 'pending'
        AND i.status IN ('draft', 'pending', 'sent', 'partial', 'partially_paid')
        AND NOT i.is_overdue)
    )
      AND (p_search IS NULL OR btrim(p_search) = ''
        OR i.invoice_number ILIKE '%' || p_search || '%'
        OR i.customer_name ILIKE '%' || p_search || '%'
        OR i.order_number ILIKE '%' || p_search || '%')
  ), page AS (
    SELECT * FROM filtered
    ORDER BY created_at DESC
    OFFSET GREATEST(p_offset, 0)
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY page.created_at DESC) FROM page), '[]'::JSONB),
    'total', (SELECT COUNT(*) FROM filtered)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_driver_cash_summary(p_driver_id UUID, p_day DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  total_collected NUMERIC,
  remitted NUMERIC,
  to_remit NUMERIC
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH totals AS (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)::NUMERIC AS total_collected,
      0::NUMERIC AS remitted
    FROM public.payments
    WHERE recorded_by = p_driver_id::TEXT
      AND (p_driver_id = auth.uid() OR public.is_admin())
      AND method = 'cash'
      AND created_at >= (p_day::TIMESTAMP AT TIME ZONE 'Africa/Nairobi')
      AND created_at < ((p_day + 1)::TIMESTAMP AT TIME ZONE 'Africa/Nairobi')
  )
  SELECT total_collected, remitted, total_collected - remitted FROM totals;
$$;

CREATE OR REPLACE FUNCTION public.get_receipt_summary(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_tag TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_business TEXT DEFAULT NULL
)
RETURNS TABLE (
  active_count BIGINT,
  active_amount NUMERIC,
  category_count BIGINT,
  current_month_amount NUMERIC
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    COUNT(*) FILTER (WHERE r.status = 'active')::BIGINT,
    COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'active'), 0)::NUMERIC,
    COUNT(DISTINCT r.category) FILTER (WHERE r.status = 'active')::BIGINT,
    COALESCE(SUM(r.amount) FILTER (
      WHERE r.status = 'active'
        AND r.date >= date_trunc('month', CURRENT_DATE)::DATE
        AND r.date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::DATE
    ), 0)::NUMERIC
  FROM public.receipts r
  WHERE (p_from IS NULL OR r.date >= p_from)
    AND (p_to IS NULL OR r.date <= p_to)
    AND (p_category IS NULL OR p_category = 'all' OR r.category = p_category)
    AND (p_tag IS NULL OR r.tags @> ARRAY[p_tag])
    AND (p_search IS NULL OR r.description ILIKE '%' || p_search || '%')
    AND (p_business IS NULL OR p_business = 'all' OR r.business = p_business);
$$;

CREATE OR REPLACE FUNCTION public.get_notification_channel_stats()
RETURNS TABLE (channel TEXT, sent BIGINT, failed BIGINT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    n.channel,
    COUNT(*) FILTER (WHERE n.status IN ('sent', 'delivered'))::BIGINT,
    COUNT(*) FILTER (WHERE n.status = 'failed')::BIGINT
  FROM public.notification_history n
  GROUP BY n.channel
  ORDER BY n.channel;
$$;

CREATE OR REPLACE FUNCTION public.get_accounting_payments_received_page(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_business TEXT DEFAULT NULL,
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 20,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_business TEXT := public.accounting_effective_business(p_business);
  v_result JSONB;
BEGIN
  WITH received AS (
    SELECT
      p.id::TEXT AS id, 'native'::TEXT AS source_kind, p.business, p.created_at,
      p.amount, 'KES'::TEXT AS currency, p.method::TEXT, p.customer_name,
      p.provider, p.provider_status, p.mpesa_receipt_number,
      COALESCE(p.mpesa_receipt_number, p.reference_number, p.reference, p.checkout_request_id) AS reference,
      NULL::TEXT AS event_type, NULL::TEXT AS external_id, p.status::TEXT,
      p.unapplied_amount, p.posted_journal_entry_id, p.recorded_by,
      p.phone_number, p.payer_phone_number, p.payer_phone_matches_intent,
      p.merchant_request_id, p.checkout_request_id, p.result_desc
    FROM public.payments p
    LEFT JOIN public.ledger_journal_entries pe ON pe.id = p.posted_journal_entry_id
    WHERE p.status = 'completed'
      AND (p.posted_journal_entry_id IS NULL OR pe.status = 'posted')
      AND (p_from IS NULL OR p.created_at::DATE >= p_from)
      AND (p_to IS NULL OR p.created_at::DATE <= p_to)
      AND (v_business IS NULL OR p.business = v_business)

    UNION ALL

    SELECT
      ie.id::TEXT, 'external'::TEXT, ie.business, COALESCE(ie.processed_at, ie.received_at),
      cash.cash_received, ie.currency,
      COALESCE(ie.payload->>'payment_method', ie.provider, 'external'),
      COALESCE(ie.payload->>'customer_name', ie.payload->>'payer_name', initcap(ie.source_system)),
      ie.provider, e.status, NULL::TEXT, ie.external_id, ie.event_type,
      ie.external_id, ie.status, 0::NUMERIC, ie.journal_entry_id,
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::BOOLEAN, NULL::TEXT, NULL::TEXT, NULL::TEXT
    FROM public.ledger_ingest_events ie
    JOIN public.ledger_journal_entries e ON e.id = ie.journal_entry_id
    JOIN LATERAL (
      SELECT ROUND(SUM(l.debit), 2) AS cash_received
      FROM public.ledger_journal_lines l
      JOIN public.chart_of_accounts coa ON coa.id = l.account_id
      WHERE l.journal_entry_id = e.id
        AND coa.system_key IN ('cash', 'bank', 'mpesa', 'mpesa_goalhub')
        AND l.debit > 0
    ) cash ON cash.cash_received > 0
    WHERE ie.status = 'posted'
      AND ie.source_system = 'goalhub'
      AND e.status = 'posted'
      AND (p_from IS NULL OR e.entry_date >= p_from)
      AND (p_to IS NULL OR e.entry_date <= p_to)
      AND (v_business IS NULL OR ie.business = v_business)
  ), filtered AS (
    SELECT * FROM received r
    WHERE p_search IS NULL OR btrim(p_search) = ''
      OR r.customer_name ILIKE '%' || p_search || '%'
      OR r.reference ILIKE '%' || p_search || '%'
      OR r.provider ILIKE '%' || p_search || '%'
  ), page AS (
    SELECT * FROM filtered
    ORDER BY created_at DESC
    OFFSET GREATEST(p_offset, 0)
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY page.created_at DESC) FROM page), '[]'::JSONB),
    'total', (SELECT COUNT(*) FROM filtered),
    'total_amount', COALESCE((SELECT SUM(amount) FROM filtered), 0)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_accounting_sales_overview(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_business TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_business TEXT := public.accounting_effective_business(p_business);
  v_result JSONB;
BEGIN
  WITH filtered AS (
    SELECT p.customer_name, p.recorded_by, p.amount
    FROM public.payments p
    LEFT JOIN public.ledger_journal_entries pe ON pe.id = p.posted_journal_entry_id
    WHERE p.status = 'completed'
      AND (p.posted_journal_entry_id IS NULL OR pe.status = 'posted')
      AND (p_from IS NULL OR p.created_at::DATE >= p_from)
      AND (p_to IS NULL OR p.created_at::DATE <= p_to)
      AND (v_business IS NULL OR p.business = v_business)
  ), by_customer AS (
    SELECT COALESCE(NULLIF(btrim(customer_name), ''), 'Customer') AS customer_name,
      SUM(amount)::NUMERIC AS total
    FROM filtered
    GROUP BY COALESCE(NULLIF(btrim(customer_name), ''), 'Customer')
    ORDER BY total DESC
  ), by_person AS (
    SELECT recorded_by AS name, SUM(amount)::NUMERIC AS total
    FROM filtered
    WHERE recorded_by IS NOT NULL AND btrim(recorded_by) <> ''
    GROUP BY recorded_by
    ORDER BY total DESC
  )
  SELECT jsonb_build_object(
    'orders', COALESCE((SELECT jsonb_agg(to_jsonb(by_customer) ORDER BY total DESC) FROM by_customer), '[]'::JSONB),
    'sales_by_person', COALESCE((SELECT jsonb_agg(to_jsonb(by_person) ORDER BY total DESC) FROM by_person), '[]'::JSONB)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_receipt_tags(p_business TEXT DEFAULT NULL)
RETURNS TABLE (tag TEXT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT DISTINCT unnest(r.tags) AS tag
  FROM public.receipts r
  WHERE p_business IS NULL OR p_business = 'all' OR r.business = p_business
  ORDER BY tag;
$$;

CREATE OR REPLACE FUNCTION public.get_warehouse_dispatch_page(
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 20,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH dispatch_latest AS (
    SELECT DISTINCT ON (d.order_id) d.*
    FROM public.warehouse_dispatch d
    ORDER BY d.order_id, d.ready_since DESC
  ), combined AS (
    SELECT
      p.id,
      p.order_id,
      p.order_number,
      p.customer_name,
      p.item_name,
      p.item_type,
      p.quantity,
      COALESCE(d.zone, o.zone, '') AS zone,
      d.assigned_driver,
      d.scheduled_delivery,
      COALESCE(d.ready_since, p.started_at, CURRENT_TIMESTAMP) AS ready_since,
      d.id AS dispatch_id
    FROM public.warehouse_processing p
    LEFT JOIN dispatch_latest d ON d.order_id = p.order_id
    LEFT JOIN public.orders o ON o.id = p.order_id
    WHERE p.stage = 'ready_for_dispatch'

    UNION ALL

    SELECT
      d.id,
      d.order_id,
      d.order_number,
      d.customer_name,
      COALESCE(array_to_string(d.items, ', '), 'Items'),
      '',
      d.total_items,
      COALESCE(d.zone, ''),
      d.assigned_driver,
      d.scheduled_delivery,
      d.ready_since,
      d.id
    FROM dispatch_latest d
    WHERE NOT EXISTS (
      SELECT 1 FROM public.warehouse_processing p
      WHERE p.order_id = d.order_id AND p.stage = 'ready_for_dispatch'
    )
  ), filtered AS (
    SELECT * FROM combined c
    WHERE p_search IS NULL OR btrim(p_search) = ''
      OR c.order_number ILIKE '%' || p_search || '%'
      OR c.customer_name ILIKE '%' || p_search || '%'
  ), page AS (
    SELECT * FROM filtered
    ORDER BY ready_since DESC
    OFFSET GREATEST(p_offset, 0)
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  SELECT jsonb_build_object(
    'rows', COALESCE(jsonb_agg(to_jsonb(page) ORDER BY page.ready_since DESC), '[]'::JSONB),
    'total', (SELECT COUNT(*) FROM filtered)
  )
  FROM page;
$$;

CREATE OR REPLACE FUNCTION public.get_warehouse_dispatch_stats()
RETURNS TABLE (ready_count BIGINT, awaiting_driver BIGINT, dispatched_count BIGINT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH dispatch_latest AS (
    SELECT DISTINCT ON (d.order_id) d.*
    FROM public.warehouse_dispatch d
    ORDER BY d.order_id, d.ready_since DESC
  ), combined AS (
    SELECT d.assigned_driver, d.scheduled_delivery
    FROM public.warehouse_processing p
    LEFT JOIN dispatch_latest d ON d.order_id = p.order_id
    WHERE p.stage = 'ready_for_dispatch'
    UNION ALL
    SELECT d.assigned_driver, d.scheduled_delivery
    FROM dispatch_latest d
    WHERE NOT EXISTS (
      SELECT 1 FROM public.warehouse_processing p
      WHERE p.order_id = d.order_id AND p.stage = 'ready_for_dispatch'
    )
  )
  SELECT
    COUNT(*) FILTER (WHERE scheduled_delivery IS NULL)::BIGINT,
    COUNT(*) FILTER (WHERE assigned_driver IS NULL AND scheduled_delivery IS NULL)::BIGINT,
    COUNT(*) FILTER (WHERE scheduled_delivery IS NOT NULL)::BIGINT
  FROM combined;
$$;

REVOKE ALL ON FUNCTION public.get_order_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_review_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_expense_summary(DATE, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_customer_billing_summary(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_billing_financial_summary(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_billing_invoices_page(TEXT, TEXT, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_driver_cash_summary(UUID, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_receipt_summary(DATE, DATE, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_notification_channel_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_accounting_payments_received_page(DATE, DATE, TEXT, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_accounting_sales_overview(DATE, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_receipt_tags(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_warehouse_dispatch_page(INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_warehouse_dispatch_stats() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_order_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_review_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_expense_summary(DATE, DATE, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_billing_summary(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_billing_financial_summary(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_billing_invoices_page(TEXT, TEXT, INTEGER, INTEGER, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_driver_cash_summary(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_receipt_summary(DATE, DATE, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_notification_channel_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_accounting_payments_received_page(DATE, DATE, TEXT, INTEGER, INTEGER, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_accounting_sales_overview(DATE, DATE, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_receipt_tags(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_warehouse_dispatch_page(INTEGER, INTEGER, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_warehouse_dispatch_stats() TO authenticated, service_role;
