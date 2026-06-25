-- ============================================================
-- Migration: Create missing tables (holidays + notifications)
-- These tables are referenced by frontend services but were
-- never created in prior migrations.
-- ============================================================

-- ── Holidays ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL UNIQUE,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "holidays_read_all" ON holidays
  FOR SELECT USING (true);
CREATE POLICY "holidays_admin_write" ON holidays
  FOR ALL USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

-- ── Notifications (in-app user notifications) ────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'order_created', 'driver_assigned', 'pickup_scheduled', 'picked_up',
    'in_processing', 'ready_for_delivery', 'out_for_delivery', 'delivered',
    'price_updated', 'general'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  order_id UUID REFERENCES orders(id),
  tracking_code TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "notifications_user_read" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_user_update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "notifications_user_delete" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- System/triggers can insert notifications for any user
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (true);

-- Admins can read all notifications
CREATE POLICY "notifications_admin_read" ON notifications
  FOR SELECT USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ── Seed: Kenyan public holidays ─────────────────────────────

INSERT INTO holidays (name, date, is_recurring, created_by) VALUES
  ('New Year''s Day', '2026-01-01', true, 'system'),
  ('Labour Day', '2026-05-01', true, 'system'),
  ('Madaraka Day', '2026-06-01', true, 'system'),
  ('Mashujaa Day', '2026-10-20', true, 'system'),
  ('Jamhuri Day', '2026-12-12', true, 'system'),
  ('Christmas Day', '2026-12-25', true, 'system'),
  ('Boxing Day', '2026-12-26', true, 'system'),
  ('Good Friday', '2026-04-03', false, 'system'),
  ('Easter Monday', '2026-04-06', false, 'system')
ON CONFLICT (date) DO NOTHING;

-- ── Seed: Sample notifications for testing ───────────────────

DO $$
DECLARE
  uid UUID;
  oid UUID;
BEGIN
  -- Get the super_admin user
  SELECT id INTO uid FROM profiles WHERE email = 'ngethenan768@gmail.com';

  IF uid IS NOT NULL THEN
    -- Get an order linked to this user
    SELECT id INTO oid FROM orders WHERE customer_id = uid LIMIT 1;

    INSERT INTO notifications (user_id, type, title, message, order_id, tracking_code, read, created_at) VALUES
      (uid, 'order_created', 'Order Confirmed', 'Your order EW-2024-00123 has been created.', oid, 'EW-2024-00123', true, '2024-01-20T08:00:00Z'),
      (uid, 'picked_up', 'Items Picked Up', 'Your items have been picked up and are on their way to our facility.', oid, 'EW-2024-00123', true, '2024-01-20T10:00:00Z'),
      (uid, 'delivered', 'Order Delivered', 'Your order EW-2024-00123 has been delivered. Thank you for choosing ExpressWash!', oid, 'EW-2024-00123', false, '2024-01-22T14:00:00Z'),
      (uid, 'general', 'Welcome to ExpressWash', 'Thank you for joining ExpressWash! Enjoy free pickup and delivery on your first order.', NULL, NULL, false, now());
  END IF;

  -- Get the customer user
  SELECT id INTO uid FROM profiles WHERE email = 'ngethenan768+customer@gmail.com';

  IF uid IS NOT NULL THEN
    SELECT id INTO oid FROM orders WHERE customer_id = uid LIMIT 1;

    INSERT INTO notifications (user_id, type, title, message, order_id, tracking_code, read, created_at) VALUES
      (uid, 'order_created', 'Order Confirmed', 'Your order EW-2024-00124 has been created.', oid, 'EW-2024-00124', false, '2024-01-25T09:00:00Z'),
      (uid, 'general', 'Welcome to ExpressWash', 'Thank you for joining ExpressWash!', NULL, NULL, false, now());
  END IF;
END $$;

-- ============================================================
-- Done! holidays and notifications tables are now available.
-- ============================================================
