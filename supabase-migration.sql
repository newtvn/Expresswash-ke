-- ============================================================
-- ExpressWash Migration — run against existing Supabase DB
-- to add columns and features introduced in production refactor
-- ============================================================

-- ── Orders: add pickup_address and notes ──────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;

-- ── Drivers: ensure upsert works with on-conflict ─────────────
ALTER TABLE drivers ALTER COLUMN status SET DEFAULT 'offline';
ALTER TABLE drivers ALTER COLUMN is_online SET DEFAULT false;

-- ── route_stops: add id column if missing from earlier seeds ──
-- (The schema already has id UUID PRIMARY KEY - this is a safety check)

-- ── Allow anon order creation for tracking ────────────────────
-- (customers track their own orders without signing in)
CREATE POLICY IF NOT EXISTS "Anon can track orders" ON orders
  FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "Anon can read order_items" ON order_items
  FOR SELECT TO anon USING (true);

-- ── Notification history: authenticated insert ────────────────
CREATE POLICY IF NOT EXISTS "Authenticated insert history" ON notification_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── Customer orders: allow insert for authenticated ───────────
-- Already covered by "Authenticated insert orders" policy

-- ── RPC: increment customer order count ──────────────────────
CREATE OR REPLACE FUNCTION increment_customer_orders(customer_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET total_orders = COALESCE(total_orders, 0) + 1,
      updated_at = now()
  WHERE id = customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Auto loyalty account creation on first order ─────────────
CREATE OR REPLACE FUNCTION ensure_loyalty_account()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO loyalty_accounts (customer_id, customer_name, points, tier, tier_progress, lifetime_points)
  SELECT NEW.customer_id, NEW.customer_name, 0, 'bronze', 0, 0
  WHERE NEW.customer_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM loyalty_accounts WHERE customer_id = NEW.customer_id
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_order_created_ensure_loyalty
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION ensure_loyalty_account();

-- ── Award loyalty points on delivery ─────────────────────────
CREATE OR REPLACE FUNCTION award_loyalty_points_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  points_to_award INTEGER := 50;
BEGIN
  -- Only trigger on status change to 12 (Delivered)
  IF NEW.status = 12 AND OLD.status <> 12 AND NEW.customer_id IS NOT NULL THEN
    UPDATE loyalty_accounts
    SET points = points + points_to_award,
        lifetime_points = lifetime_points + points_to_award
    WHERE customer_id = NEW.customer_id;

    INSERT INTO loyalty_transactions (customer_id, points, type, description, order_id, balance_after)
    SELECT
      NEW.customer_id,
      points_to_award,
      'earned',
      'Points earned for completed order ' || NEW.tracking_code,
      NEW.tracking_code,
      la.points
    FROM loyalty_accounts la WHERE la.customer_id = NEW.customer_id;

    -- Update profile loyalty_points
    UPDATE profiles
    SET loyalty_points = COALESCE(loyalty_points, 0) + points_to_award,
        total_spent = COALESCE(total_spent, 0) + 2500
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_order_delivered_award_points
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_points_on_delivery();

-- ── Index: orders by customer and status ─────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
