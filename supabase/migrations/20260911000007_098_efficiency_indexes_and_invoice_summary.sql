-- Efficiency pass (indexes + STABLE role checks + invoice summary RPC).
--
-- 1. Hot operational tables (driver routing, warehouse pipeline, QC) had no
--    indexes beyond their primary keys, so RPC joins and filtered lists did
--    sequential scans. Add the indexes that match the real query filters.
-- 2. Composite indexes that back the new server-side pagination on the admin
--    invoices list and the customer payments list.
-- 3. Legacy role-check helpers were VOLATILE, so under RLS they re-ran a
--    profiles lookup per row on large-table scans. Mark them STABLE so Postgres
--    evaluates them once per statement.
-- 4. get_invoice_summary(): the paginated invoices page still needs correct
--    header totals across the whole (business-scoped) set, computed in the DB
--    instead of fetching every row into the browser.

-- ── Operational indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id
  ON public.route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_driver_routes_driver_date
  ON public.driver_routes(driver_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_processing_stage_started
  ON public.warehouse_processing(stage, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_intake_received_at
  ON public.warehouse_intake(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_dispatch_order_id
  ON public.warehouse_dispatch(order_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_dispatch_ready_since
  ON public.warehouse_dispatch(ready_since DESC);
CREATE INDEX IF NOT EXISTS idx_quality_checks_item_id
  ON public.quality_checks(item_id);
CREATE INDEX IF NOT EXISTS idx_quality_checks_order_id
  ON public.quality_checks(order_id);

-- ── Pagination-supporting composites ──────────────────────────────────
-- Admin invoices list: filter by business, order by created_at DESC.
CREATE INDEX IF NOT EXISTS idx_invoices_business_created_at
  ON public.invoices(business, created_at DESC);
-- Customer payments list: filter by customer_id, order by created_at DESC.
CREATE INDEX IF NOT EXISTS idx_payments_customer_created_at
  ON public.payments(customer_id, created_at DESC);

-- ── STABLE role checks ────────────────────────────────────────────────
ALTER FUNCTION public.is_admin() STABLE;
ALTER FUNCTION public.is_driver() STABLE;
ALTER FUNCTION public.is_warehouse_staff() STABLE;

-- ── Invoice summary for the paginated list header ─────────────────────
-- SECURITY INVOKER: the caller's RLS on invoices scopes what they can see;
-- p_business mirrors the list's business filter (NULL/'all' = no filter).
CREATE OR REPLACE FUNCTION public.get_invoice_summary(p_business TEXT DEFAULT NULL)
RETURNS TABLE (
  total_count BIGINT,
  paid_count BIGINT,
  outstanding_total NUMERIC,
  received_total NUMERIC
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'paid'),
    COALESCE(SUM(balance) FILTER (WHERE status NOT IN ('paid', 'cancelled') AND balance > 0), 0),
    COALESCE(SUM(paid_amount) FILTER (WHERE status NOT IN ('draft', 'cancelled')), 0)
  FROM public.invoices
  WHERE (p_business IS NULL OR p_business = 'all' OR business = p_business);
$$;

REVOKE ALL ON FUNCTION public.get_invoice_summary(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_invoice_summary(TEXT) TO authenticated, service_role;
