-- ============================================================
-- Fix drivers table RLS so admins can see ALL driver records
-- and drivers can see/update only their own record.
--
-- Root cause: new drivers created via create-user edge function
-- were invisible to admins if the drivers table had no RLS
-- read policy covering is_admin(), or if the profile row wasn't
-- created with role='driver' (trigger timing issue).
-- ============================================================

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Admins: full access to all driver records
DROP POLICY IF EXISTS "Admins can manage all drivers" ON drivers;
CREATE POLICY "Admins can manage all drivers" ON drivers
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Drivers: read own record
DROP POLICY IF EXISTS "Drivers can view own record" ON drivers;
CREATE POLICY "Drivers can view own record" ON drivers
  FOR SELECT TO authenticated USING (id = auth.uid());

-- Drivers: update own record (status, location)
DROP POLICY IF EXISTS "Drivers can update own record" ON drivers;
CREATE POLICY "Drivers can update own record" ON drivers
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Drivers: insert own record (first login / self-register case)
DROP POLICY IF EXISTS "Drivers can insert own record" ON drivers;
CREATE POLICY "Drivers can insert own record" ON drivers
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
