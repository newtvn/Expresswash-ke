-- ============================================================
-- Migration: Create 8 new production tables
-- Tables: zones, order_status_history, reviews, expenses,
--         promotions, promotion_usage, payment_reminders,
--         notification_preferences
-- All with RLS enabled and appropriate policies.
-- ============================================================

-- ============================================================
-- ZONES
-- Centralizes zone-based delivery policies that are currently
-- hardcoded as text strings across the codebase.
-- ============================================================
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  delivery_policy TEXT NOT NULL CHECK (delivery_policy IN ('same_day', '48_hour')),
  delivery_days TEXT[],
  base_delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  cutoff_time TIME,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones_read_all" ON zones FOR SELECT USING (true);
CREATE POLICY "zones_admin_write" ON zones FOR ALL USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_zones_active ON zones(is_active) WHERE is_active = true;

-- Seed the three operational zones
INSERT INTO zones (name, delivery_policy, delivery_days, base_delivery_fee, cutoff_time)
VALUES
  ('Kitengela', 'same_day', NULL, 200.00, '12:00:00'),
  ('Athi River', 'same_day', NULL, 200.00, '12:00:00'),
  ('Greater Nairobi', '48_hour', ARRAY['monday','wednesday','friday'], 350.00, NULL)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- ORDER STATUS HISTORY
-- Dedicated table for order status timeline view.
-- Currently status changes are only in audit_logs with
-- inconsistent structure.
-- ============================================================
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  from_status INTEGER,
  to_status INTEGER NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Customers can read history for their own orders
CREATE POLICY "status_history_customer_read" ON order_status_history
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE customer_id = auth.uid()
    )
  );

-- Staff can read all history
CREATE POLICY "status_history_staff_read" ON order_status_history
  FOR SELECT USING (
    is_admin() OR is_driver() OR is_warehouse_staff()
  );

CREATE INDEX IF NOT EXISTS idx_status_history_order
  ON order_status_history(order_id, created_at DESC);

-- ============================================================
-- REVIEWS
-- Backs the existing customer review submission and admin
-- moderation UI pages that currently have no database table.
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  driver_id UUID,
  overall_rating SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  service_rating SMALLINT CHECK (service_rating BETWEEN 1 AND 5),
  driver_rating SMALLINT CHECK (driver_rating BETWEEN 1 AND 5),
  review_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_response TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_customer_insert" ON reviews
  FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "reviews_customer_read_own" ON reviews
  FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "reviews_public_read" ON reviews
  FOR SELECT USING (status = 'approved' AND is_public = true);
CREATE POLICY "reviews_admin_all" ON reviews
  FOR ALL USING (is_admin());
CREATE POLICY "reviews_customer_update" ON reviews
  FOR UPDATE USING (customer_id = auth.uid() AND status = 'pending')
  WITH CHECK (customer_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_public
  ON reviews(is_public, created_at DESC) WHERE status = 'approved';

-- ============================================================
-- EXPENSES
-- Backs the admin expense page at /admin/profit-expense
-- which currently has no database table.
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'fuel', 'supplies', 'salary', 'rent', 'utilities',
    'marketing', 'maintenance', 'other'
  )),
  subcategory VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  reference_number VARCHAR(100),
  driver_id UUID,
  supplier VARCHAR(255),
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'cash', 'mpesa', 'bank_transfer', 'card'
  )),
  expense_date DATE NOT NULL,
  receipt_path VARCHAR(500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_admin_all" ON expenses FOR ALL USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

-- ============================================================
-- PROMOTIONS
-- Required for birthday discounts, referral rewards, and
-- seasonal campaigns.
-- ============================================================
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  code VARCHAR(30) NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2),
  max_discount_amount DECIMAL(10,2),
  usage_limit INTEGER,
  usage_per_customer INTEGER DEFAULT 1,
  times_used INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  promotion_type TEXT DEFAULT 'manual' CHECK (promotion_type IN (
    'manual', 'birthday', 'referral', 'seasonal', 'winback'
  )),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promotion_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id),
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  discount_applied DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotions_read_active" ON promotions
  FOR SELECT USING (is_active = true AND valid_until >= now());
CREATE POLICY "promotions_admin_all" ON promotions FOR ALL USING (is_admin());
CREATE POLICY "promo_usage_admin_read" ON promotion_usage
  FOR SELECT USING (is_admin());
CREATE POLICY "promo_usage_system_insert" ON promotion_usage
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_active
  ON promotions(is_active, valid_from, valid_until) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promo_usage_customer
  ON promotion_usage(customer_id, promotion_id);

-- ============================================================
-- PAYMENT REMINDERS
-- Tracks which reminders have been sent per invoice to
-- prevent duplicate reminder notifications.
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  reminder_number INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notification_id UUID
);

ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders_admin_only" ON payment_reminders FOR ALL USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_reminders_invoice ON payment_reminders(invoice_id);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- Customer communication preferences for opt-out compliance.
-- Auto-created on profile creation via trigger (Day 2).
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  sms_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT true,
  marketing_opt_in BOOLEAN DEFAULT true,
  order_updates BOOLEAN DEFAULT true,
  payment_reminders BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prefs_own" ON notification_preferences
  FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "prefs_admin_read" ON notification_preferences
  FOR SELECT USING (is_admin());

-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
  required_tables TEXT[] := ARRAY[
    'zones', 'order_status_history', 'reviews', 'expenses',
    'promotions', 'promotion_usage', 'payment_reminders',
    'notification_preferences'
  ];
BEGIN
  -- Check all tables exist
  FOREACH tbl IN ARRAY required_tables LOOP
    ASSERT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ), 'MISSING TABLE: ' || tbl;
  END LOOP;
  RAISE NOTICE '✓ All 8 new tables exist';

  -- Check RLS is enabled
  FOREACH tbl IN ARRAY required_tables LOOP
    ASSERT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE tablename = tbl AND rowsecurity = true
    ), 'RLS NOT ENABLED: ' || tbl;
  END LOOP;
  RAISE NOTICE '✓ RLS enabled on all new tables';

  -- Check zones seeded
  ASSERT (SELECT count(*) FROM zones) >= 3, 'Zones not seeded — expected at least 3';
  RAISE NOTICE '✓ Zones seeded (3 records)';
END $$;
