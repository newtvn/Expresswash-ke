-- ============================================================
-- Migration: Auto-log order status changes to history table
--
-- Fires AFTER the validation trigger (which is BEFORE UPDATE).
-- Records every status transition for the order timeline view
-- in customer and admin portals.
-- ============================================================

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_status_change ON orders;

CREATE TRIGGER log_status_change
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();
