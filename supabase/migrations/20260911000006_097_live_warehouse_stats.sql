-- Inventory Management KPI cards read from warehouse_stats, but that table was
-- static seed data (frozen 47/12/8/5/14/3) with no link to warehouse_processing.
-- Keep the table (realtime + RLS + existing reads stay intact) but derive its
-- computed columns from the live pipeline via a trigger, preserving the
-- operator-configured capacity_total.

CREATE OR REPLACE FUNCTION public.refresh_warehouse_stats()
RETURNS VOID AS $$
DECLARE
  v_total INTEGER;
  v_washing INTEGER;
  v_drying INTEGER;
  v_qc INTEGER;
  v_ready INTEGER;
  v_overdue INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE stage = 'washing'),
    COUNT(*) FILTER (WHERE stage = 'drying'),
    COUNT(*) FILTER (WHERE stage = 'quality_check'),
    COUNT(*) FILTER (WHERE stage = 'ready_for_dispatch'),
    COUNT(*) FILTER (WHERE stage <> 'ready_for_dispatch' AND (
      (estimated_completion IS NOT NULL AND estimated_completion < now())
      OR (estimated_completion IS NULL AND started_at IS NOT NULL AND started_at < now() - INTERVAL '3 days')
    ))
  INTO v_total, v_washing, v_drying, v_qc, v_ready, v_overdue
  FROM public.warehouse_processing;

  -- Refresh every stats row (there should only be one) so whichever row the
  -- client reads is fresh; keep the operator-configured capacity_total. Seed a
  -- row only when the table is empty.
  UPDATE public.warehouse_stats
  SET total_items = v_total,
      in_washing = v_washing,
      in_drying = v_drying,
      in_quality_check = v_qc,
      ready_for_dispatch = v_ready,
      overdue_items = v_overdue,
      capacity_used = v_total,
      updated_at = now();

  IF NOT FOUND THEN
    INSERT INTO public.warehouse_stats (
      total_items, in_washing, in_drying, in_quality_check,
      ready_for_dispatch, overdue_items, capacity_used, capacity_total
    ) VALUES (
      v_total, v_washing, v_drying, v_qc, v_ready, v_overdue, v_total, 200
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.refresh_warehouse_stats() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.trg_refresh_warehouse_stats()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.refresh_warehouse_stats();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.trg_refresh_warehouse_stats() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS warehouse_processing_stats_refresh ON public.warehouse_processing;
CREATE TRIGGER warehouse_processing_stats_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.warehouse_processing
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_warehouse_stats();

-- Backfill once so the cards reflect reality immediately after deploy.
SELECT public.refresh_warehouse_stats();
