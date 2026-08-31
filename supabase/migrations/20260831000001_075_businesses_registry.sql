-- B1: business registry + slug resolver. Additive/behaviour-neutral.
-- Tagging lands in 076, business-aware posting in 077, RBAC in 078-080.

-- is_native = keeps its own source documents here (invoices/bills/etc.).
-- source_system = the ingest source_system an external business maps to (073).
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9_]*$'),
  name TEXT NOT NULL,
  source_system TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_native BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_businesses_active
  ON businesses(slug) WHERE active = TRUE;

INSERT INTO businesses (slug, name, source_system, active, is_native)
VALUES
  ('expresswash', 'Expresswash', NULL,      TRUE, TRUE),
  ('goalhub',     'Goalhub',     'goalhub', TRUE, FALSE)
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  source_system = EXCLUDED.source_system,
  is_native     = EXCLUDED.is_native,
  active        = TRUE,
  updated_at    = NOW();

DROP TRIGGER IF EXISTS trg_businesses_updated_at ON businesses;
CREATE TRIGGER trg_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION accounting_touch_updated_at();

-- Admins manage; the switcher reads. GRANT gives the privilege, policy scopes rows.
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "businesses_admin_all" ON businesses;
CREATE POLICY "businesses_admin_all" ON businesses
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());
GRANT SELECT ON businesses TO authenticated;

-- NULL/'' -> NULL; known active slug -> slug; anything else -> RAISE.
CREATE OR REPLACE FUNCTION accounting_resolve_business(p_business TEXT)
RETURNS TEXT AS $$
DECLARE
  v_slug TEXT;
BEGIN
  v_slug := NULLIF(TRIM(p_business), '');
  IF v_slug IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE slug = v_slug AND active = TRUE) THEN
    RAISE EXCEPTION 'Unknown or inactive business: %', v_slug
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN v_slug;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION accounting_resolve_business(TEXT) TO authenticated, service_role;
