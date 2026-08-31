-- B2: RBAC helpers for multi-business access. Helpers only — no policy or
-- report changes here, so this is a no-op until 079 (reports) and 080 (RLS).
-- super_admin sees/manages every business; a regular admin is Expresswash-only.

-- service_role is trusted backend (mirrors accounting_is_admin).
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin');
EXCEPTION WHEN undefined_function THEN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Resolve the business a READ should scope to.
--   super_admin: NULL/'all' -> NULL (consolidated); else a validated slug.
--   regular admin: NULL/'expresswash' -> 'expresswash'; any other request RAISEs.
CREATE OR REPLACE FUNCTION accounting_effective_business(p_business TEXT)
RETURNS TEXT AS $$
DECLARE
  v TEXT;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v := NULLIF(TRIM(p_business), '');

  IF is_super_admin() THEN
    IF v IS NULL OR v = 'all' THEN
      RETURN NULL;
    END IF;
    RETURN accounting_resolve_business(v);
  END IF;

  IF v IS NULL OR v = 'expresswash' THEN
    RETURN 'expresswash';
  END IF;
  RAISE EXCEPTION 'Not authorized for business %', v USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Row-visibility predicate for RLS (applied per row on tables with a business).
-- Regular admin also sees untagged native rows (business IS NULL).
CREATE OR REPLACE FUNCTION accounting_can_see_business(p_business TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF is_super_admin() THEN
    RETURN TRUE;
  END IF;
  IF NOT accounting_is_admin() THEN
    RETURN FALSE;
  END IF;
  RETURN p_business IS NULL OR p_business = 'expresswash';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION accounting_effective_business(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION accounting_can_see_business(TEXT) TO authenticated, service_role;

-- Tighten the businesses registry now that is_super_admin() exists: any admin may
-- READ it (the switcher needs the list), but only a super_admin may create/modify a
-- business. (075 seeded it with an admin-all policy that let a regular admin mutate
-- the registry — e.g. rename/deactivate goalhub — which contradicts the RBAC model.)
DROP POLICY IF EXISTS "businesses_admin_all" ON businesses;
DROP POLICY IF EXISTS "businesses_read" ON businesses;
DROP POLICY IF EXISTS "businesses_super_admin_write" ON businesses;
CREATE POLICY "businesses_read" ON businesses
  FOR SELECT TO authenticated USING (accounting_is_admin());
CREATE POLICY "businesses_super_admin_write" ON businesses
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
