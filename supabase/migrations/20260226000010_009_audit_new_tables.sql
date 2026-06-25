-- ============================================================
-- Migration: Audit triggers for new tables
--
-- The audit_logs table has these NOT NULL columns that must be
-- populated: user_id, user_name, user_role, action, entity,
-- details, ip_address, timestamp.
--
-- Database triggers do NOT have HTTP context, so ip_address
-- uses 'db-trigger' as a placeholder.
--
-- Also fixes the existing audit_sensitive_update() function
-- which references non-existent columns (resource_type,
-- resource_id) instead of the actual columns (entity, entity_id).
-- ============================================================

CREATE OR REPLACE FUNCTION generic_audit_trigger()
RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_logs (
    timestamp,
    user_id,
    user_name,
    user_role,
    action,
    entity,
    entity_id,
    details,
    ip_address
  ) VALUES (
    now(),
    COALESCE(auth.uid()::TEXT, 'system'),
    COALESCE((SELECT name FROM profiles WHERE id = auth.uid()), 'system'),
    COALESCE((SELECT role::TEXT FROM profiles WHERE id = auth.uid()), 'system'),
    TG_OP,
    TG_TABLE_NAME,
    CASE TG_OP
      WHEN 'DELETE' THEN OLD.id::TEXT
      ELSE NEW.id::TEXT
    END,
    jsonb_build_object(
      'operation', TG_OP,
      'old', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    )::TEXT,
    'db-trigger'
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the existing audit_sensitive_update function that references
-- wrong column names (resource_type/resource_id instead of entity/entity_id)
CREATE OR REPLACE FUNCTION audit_sensitive_update()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    timestamp,
    user_id,
    user_name,
    user_role,
    action,
    entity,
    entity_id,
    details,
    ip_address
  ) VALUES (
    now(),
    COALESCE(auth.uid()::TEXT, 'system'),
    COALESCE((SELECT name FROM profiles WHERE id = auth.uid()), 'system'),
    COALESCE((SELECT role::TEXT FROM profiles WHERE id = auth.uid()), 'system'),
    TG_OP || '_' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    NEW.id::TEXT,
    jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    )::TEXT,
    'db-trigger'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply generic audit trigger to new tables
DROP TRIGGER IF EXISTS audit_reviews ON reviews;
CREATE TRIGGER audit_reviews AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION generic_audit_trigger();

DROP TRIGGER IF EXISTS audit_expenses ON expenses;
CREATE TRIGGER audit_expenses AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION generic_audit_trigger();

DROP TRIGGER IF EXISTS audit_promotions ON promotions;
CREATE TRIGGER audit_promotions AFTER INSERT OR UPDATE OR DELETE ON promotions
  FOR EACH ROW EXECUTE FUNCTION generic_audit_trigger();

DROP TRIGGER IF EXISTS audit_zones ON zones;
CREATE TRIGGER audit_zones AFTER INSERT OR UPDATE OR DELETE ON zones
  FOR EACH ROW EXECUTE FUNCTION generic_audit_trigger();
