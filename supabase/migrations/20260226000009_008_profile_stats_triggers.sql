-- ============================================================
-- Migration: Profile stats consistency triggers
--
-- 1. update_profile_stats_on_delivery: keeps total_orders and
--    total_spent on profiles consistent when orders are delivered
--    or cancelled/refunded from delivered state.
--    Uses orders.total (not total_amount).
--
-- 2. create_notification_preferences: auto-creates a row in
--    notification_preferences when a new profile is created.
-- ============================================================

-- ============================================================
-- Update profile stats when order status transitions
-- ============================================================
CREATE OR REPLACE FUNCTION update_profile_stats_on_delivery()
RETURNS trigger AS $$
BEGIN
  -- Transition TO delivered (12): increment stats
  IF NEW.status = 12 AND OLD.status != 12 THEN
    UPDATE profiles SET
      total_orders = COALESCE(total_orders, 0) + 1,
      total_spent = COALESCE(total_spent, 0) + COALESCE(NEW.total, 0)
    WHERE id = NEW.customer_id;
  END IF;

  -- Transition FROM delivered to cancelled/refunded: decrement stats
  IF OLD.status = 12 AND NEW.status IN (13, 14) THEN
    UPDATE profiles SET
      total_orders = GREATEST(COALESCE(total_orders, 0) - 1, 0),
      total_spent = GREATEST(COALESCE(total_spent, 0) - COALESCE(OLD.total, 0), 0)
    WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_delivery_stats ON orders;

CREATE TRIGGER on_order_delivery_stats
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_stats_on_delivery();

-- ============================================================
-- Auto-create notification preferences on profile creation
-- ============================================================
CREATE OR REPLACE FUNCTION create_notification_preferences()
RETURNS trigger AS $$
BEGIN
  INSERT INTO notification_preferences (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_prefs ON profiles;

CREATE TRIGGER on_profile_created_prefs
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_preferences();
