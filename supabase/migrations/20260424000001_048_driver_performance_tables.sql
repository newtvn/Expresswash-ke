-- ============================================================
-- Create driver_performance_stats and driver_monthly_trends tables
-- Referenced by driverService.ts and RLS policies in init.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS driver_performance_stats (
  driver_id UUID PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
  driver_name TEXT NOT NULL DEFAULT '',
  total_deliveries INTEGER NOT NULL DEFAULT 0,
  on_time_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_fuel_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  avg_deliveries_per_day NUMERIC(5,2) NOT NULL DEFAULT 0,
  completed_today INTEGER NOT NULL DEFAULT 0,
  active_route_stops INTEGER NOT NULL DEFAULT 0,
  customer_complaints INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE driver_performance_stats ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS driver_monthly_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  deliveries INTEGER NOT NULL DEFAULT 0,
  on_time_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  revenue NUMERIC(10,2) NOT NULL DEFAULT 0,
  UNIQUE(driver_id, month)
);

ALTER TABLE driver_monthly_trends ENABLE ROW LEVEL SECURITY;

-- Re-create RLS policies (safe with IF NOT EXISTS pattern via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read own performance' AND tablename = 'driver_performance_stats') THEN
    CREATE POLICY "Drivers can read own performance" ON driver_performance_stats
      FOR SELECT TO authenticated USING (driver_id = auth.uid() OR is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System can manage performance stats' AND tablename = 'driver_performance_stats') THEN
    CREATE POLICY "System can manage performance stats" ON driver_performance_stats
      FOR ALL TO service_role USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage performance stats' AND tablename = 'driver_performance_stats') THEN
    CREATE POLICY "Admins can manage performance stats" ON driver_performance_stats
      FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read own trends' AND tablename = 'driver_monthly_trends') THEN
    CREATE POLICY "Drivers can read own trends" ON driver_monthly_trends
      FOR SELECT TO authenticated USING (driver_id = auth.uid() OR is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System can manage monthly trends' AND tablename = 'driver_monthly_trends') THEN
    CREATE POLICY "System can manage monthly trends" ON driver_monthly_trends
      FOR ALL TO service_role USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage monthly trends' AND tablename = 'driver_monthly_trends') THEN
    CREATE POLICY "Admins can manage monthly trends" ON driver_monthly_trends
      FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
  END IF;
END $$;

-- Seed initial stats for existing drivers
INSERT INTO driver_performance_stats (driver_id, driver_name, total_deliveries, on_time_rate, avg_rating)
SELECT d.id, COALESCE(p.name, ''), d.total_deliveries, 0, d.rating
FROM drivers d
JOIN profiles p ON p.id = d.id
ON CONFLICT (driver_id) DO NOTHING;
