-- ============================================================
-- ExpressWash — Consolidated Database Init Script
-- Run this ONCE on a fresh Supabase project, in the SQL Editor.
-- After this, proceed to Phase 4 migrations in order.
--
-- Merges: supabase-schema.sql, supabase-migration.sql,
--         supabase-migration-payments.sql,
--         supabase-migration-dimensions.sql,
--         supabase-migration-security-fixes.sql
-- ============================================================

-- ============================================================
-- PART 0: SYSTEM CONFIG (needed by pricing functions)
-- ============================================================

CREATE TABLE system_config (
  id TEXT PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_config_read" ON system_config
  FOR SELECT TO authenticated USING (true);
-- admin write policy is in PART 16 (after is_admin() is defined)

-- ============================================================
-- PART 1: CUSTOM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('customer', 'driver', 'warehouse_staff', 'admin', 'super_admin');
CREATE TYPE loyalty_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum');
CREATE TYPE processing_stage AS ENUM ('intake', 'washing', 'drying', 'quality_check', 'ready_for_dispatch');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled');
CREATE TYPE notification_channel AS ENUM ('sms', 'email', 'whatsapp', 'push');
CREATE TYPE notification_status AS ENUM ('sent', 'delivered', 'failed', 'pending');
CREATE TYPE driver_status AS ENUM ('available', 'on_route', 'on_break', 'offline');
CREATE TYPE route_status AS ENUM ('planned', 'in_progress', 'completed');
CREATE TYPE route_stop_type AS ENUM ('pickup', 'delivery');
CREATE TYPE route_stop_status AS ENUM ('pending', 'completed', 'skipped');
CREATE TYPE loyalty_transaction_type AS ENUM ('earned', 'redeemed', 'expired', 'bonus', 'adjustment');
CREATE TYPE referral_status AS ENUM ('pending', 'completed', 'expired');
CREATE TYPE log_level AS ENUM ('info', 'warn', 'error', 'debug');

-- Payment enums — unified superset from both schemas
CREATE TYPE payment_method AS ENUM ('mpesa', 'cash', 'card', 'bank_transfer', 'qr_code');
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled');

-- ============================================================
-- PART 2: PROFILES (extends Supabase auth.users)
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'customer',
  zone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  loyalty_points INTEGER DEFAULT 0,
  loyalty_tier loyalty_tier DEFAULT 'bronze',
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC(12,2) DEFAULT 0,
  -- WK1 additions
  birthday DATE,
  preferred_language TEXT DEFAULT 'en',
  archived_at TIMESTAMPTZ
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role public.user_role := 'customer';
BEGIN
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL
     AND NEW.raw_user_meta_data->>'role' <> '' THEN
    _role := (NEW.raw_user_meta_data->>'role')::public.user_role;
  END IF;

  INSERT INTO public.profiles (id, email, name, phone, role, zone)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    _role,
    NEW.raw_user_meta_data->>'zone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- PART 3: ROLE-CHECK HELPER FUNCTIONS
-- (needed by RLS policies throughout)
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_driver()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'driver'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_warehouse_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'warehouse_staff'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 4: ORDERS (with dimension pricing + payment columns)
-- ============================================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES profiles(id),
  customer_name TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 1,
  pickup_date TEXT,
  estimated_delivery TEXT,
  zone TEXT NOT NULL,
  pickup_address TEXT,
  notes TEXT,
  driver_id UUID REFERENCES profiles(id),
  driver_name TEXT,
  driver_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- WK1 additions
  sla_deadline TIMESTAMPTZ,
  priority TEXT DEFAULT 'normal',
  -- Dimension-based pricing columns
  subtotal NUMERIC(12,2),
  delivery_fee NUMERIC(12,2),
  vat NUMERIC(12,2),
  total NUMERIC(12,2),
  -- Payment tracking (from supabase-migration-payments.sql)
  payment_status TEXT DEFAULT 'unpaid',
  payment_method payment_method DEFAULT 'cash',
  -- Constraint
  CONSTRAINT orders_priority_check CHECK (priority IN ('normal', 'high', 'urgent')),
  CONSTRAINT check_order_status CHECK (status >= 1 AND status <= 14)
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  -- Dimension-based pricing columns
  item_type TEXT,
  length_inches NUMERIC(10,2),
  width_inches NUMERIC(10,2),
  unit_price NUMERIC(12,2),
  total_price NUMERIC(12,2)
);

-- ============================================================
-- PART 5: DRIVERS
-- ============================================================

CREATE TABLE drivers (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_plate TEXT,
  vehicle_type TEXT,
  license_number TEXT,
  status driver_status NOT NULL DEFAULT 'offline',
  is_online BOOLEAN NOT NULL DEFAULT false,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  location_updated_at TIMESTAMPTZ,
  total_deliveries INTEGER DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_driver_rating CHECK (rating >= 0 AND rating <= 5)
);

-- ============================================================
-- PART 6: DRIVER ROUTES & STOPS
-- ============================================================

CREATE TABLE driver_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  date TEXT NOT NULL,
  zone TEXT NOT NULL,
  total_distance NUMERIC(8,2) DEFAULT 0,
  estimated_duration INTEGER DEFAULT 0,
  status route_status NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES driver_routes(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  address TEXT NOT NULL,
  type route_stop_type NOT NULL,
  scheduled_time TEXT NOT NULL,
  completed_time TEXT,
  status route_stop_status NOT NULL DEFAULT 'pending',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- PART 7: WAREHOUSE
-- ============================================================

CREATE TABLE warehouse_intake (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  condition_notes TEXT,
  warehouse_location TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by TEXT NOT NULL
);

CREATE TABLE warehouse_processing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  stage processing_stage NOT NULL DEFAULT 'intake',
  assigned_to TEXT,
  started_at TIMESTAMPTZ,
  estimated_completion TIMESTAMPTZ,
  warehouse_location TEXT NOT NULL,
  days_in_warehouse INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE warehouse_dispatch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  zone TEXT NOT NULL,
  items TEXT[] NOT NULL DEFAULT '{}',
  total_items INTEGER NOT NULL DEFAULT 0,
  ready_since TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_driver TEXT,
  scheduled_delivery TIMESTAMPTZ
);

CREATE TABLE quality_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL,
  order_id TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  notes TEXT,
  checked_by TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issues TEXT[]
);

CREATE TABLE warehouse_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_items INTEGER DEFAULT 0,
  in_washing INTEGER DEFAULT 0,
  in_drying INTEGER DEFAULT 0,
  in_quality_check INTEGER DEFAULT 0,
  ready_for_dispatch INTEGER DEFAULT 0,
  overdue_items INTEGER DEFAULT 0,
  capacity_used INTEGER DEFAULT 0,
  capacity_total INTEGER DEFAULT 200,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 8: INVOICES
-- ============================================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id),
  order_number TEXT NOT NULL,
  customer_id UUID REFERENCES profiles(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 16,
  vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- PART 9: PAYMENTS (unified — both invoice + order based)
-- ============================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Can reference either an order (STK Push) or invoice (manual)
  order_id UUID REFERENCES orders(id),
  invoice_id UUID REFERENCES invoices(id),
  -- Common fields
  amount NUMERIC(12,2) NOT NULL,
  method payment_method NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  -- Invoice-based fields (Schema A)
  invoice_number TEXT,
  reference TEXT,
  recorded_by TEXT,
  notes TEXT,
  -- Order/STK Push fields (Schema B)
  phone_number TEXT,
  customer_name TEXT,
  transaction_id TEXT,
  merchant_request_id TEXT,
  checkout_request_id TEXT,
  reference_number TEXT,
  result_code INTEGER,
  result_desc TEXT,
  failure_reason TEXT,
  receipt_url VARCHAR(500),
  mpesa_receipt_number TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  -- At least one reference must exist
  CONSTRAINT chk_payment_has_reference CHECK (order_id IS NOT NULL OR invoice_id IS NOT NULL),
  CONSTRAINT check_payment_amount CHECK (amount > 0)
);

-- Unique constraint on transaction_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_transaction_id
  ON payments(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- ============================================================
-- PART 10: LOYALTY
-- ============================================================

CREATE TABLE loyalty_accounts (
  customer_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  tier loyalty_tier NOT NULL DEFAULT 'bronze',
  tier_progress INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  next_tier loyalty_tier,
  points_to_next_tier INTEGER,
  CONSTRAINT check_loyalty_points CHECK (points >= 0),
  CONSTRAINT check_lifetime_points CHECK (lifetime_points >= 0)
);

CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES profiles(id),
  points INTEGER NOT NULL,
  type loyalty_transaction_type NOT NULL,
  description TEXT NOT NULL,
  order_id TEXT,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  points_cost INTEGER NOT NULL,
  discount_type TEXT NOT NULL,
  discount_value NUMERIC(12,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_until TIMESTAMPTZ
);

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id),
  referrer_name TEXT NOT NULL,
  referee_id UUID REFERENCES profiles(id),
  referee_name TEXT,
  referee_email TEXT NOT NULL,
  referral_code TEXT NOT NULL,
  status referral_status NOT NULL DEFAULT 'pending',
  points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- PART 11: AUDIT & SYSTEM LOGS
-- ============================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  is_suspicious BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  level log_level NOT NULL DEFAULT 'info',
  service TEXT NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  metadata JSONB
);

-- ============================================================
-- PART 12: NOTIFICATION TEMPLATES & HISTORY
-- ============================================================

CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel notification_channel NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES notification_templates(id),
  template_name TEXT NOT NULL,
  channel notification_channel NOT NULL,
  recipient_id TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_contact TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status notification_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  failure_reason TEXT,
  -- WK1 addition
  retry_count INTEGER DEFAULT 0
);

-- ============================================================
-- PART 13: DRIVER PERFORMANCE & REPORTS
-- ============================================================

CREATE TABLE driver_performance_stats (
  driver_id UUID PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
  driver_name TEXT NOT NULL,
  total_deliveries INTEGER DEFAULT 0,
  on_time_rate NUMERIC(5,2) DEFAULT 0,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  total_fuel_cost NUMERIC(12,2) DEFAULT 0,
  avg_deliveries_per_day NUMERIC(5,2) DEFAULT 0,
  completed_today INTEGER DEFAULT 0,
  active_route_stops INTEGER DEFAULT 0,
  customer_complaints INTEGER DEFAULT 0,
  CONSTRAINT check_on_time_rate CHECK (on_time_rate >= 0 AND on_time_rate <= 100)
);

CREATE TABLE driver_monthly_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  deliveries INTEGER NOT NULL DEFAULT 0,
  on_time_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE report_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL,
  change NUMERIC(5,2) DEFAULT 0,
  change_direction TEXT DEFAULT 'up',
  format TEXT DEFAULT 'number',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE report_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  orders INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_order_value NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE report_zone_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone TEXT NOT NULL,
  orders INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_delivery_time NUMERIC(5,2) NOT NULL DEFAULT 0,
  customer_satisfaction NUMERIC(3,2) NOT NULL DEFAULT 0,
  on_time_rate NUMERIC(5,2) NOT NULL DEFAULT 0
);

CREATE TABLE report_revenue_by_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  avg_price NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE report_driver_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id TEXT NOT NULL,
  name TEXT NOT NULL,
  deliveries INTEGER NOT NULL DEFAULT 0,
  on_time_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  fuel_cost NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE report_customer_demographics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_order_value NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- PART 14: INDEXES
-- ============================================================

-- Profiles
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_zone ON profiles(zone);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);

-- Orders
CREATE INDEX idx_orders_tracking_code ON orders(tracking_code);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_zone ON orders(zone);
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Invoices
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- Payments
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_checkout_request_id ON payments(checkout_request_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_payments_method ON payments(method);

-- Loyalty
CREATE INDEX idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);

-- Logs
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp);
CREATE INDEX idx_system_logs_level ON system_logs(level);

-- Notifications
CREATE INDEX idx_notification_history_recipient ON notification_history(recipient_id);

-- ============================================================
-- PART 15: ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_processing ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_dispatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_performance_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_monthly_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_zone_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_revenue_by_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_driver_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_customer_demographics ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 16: RLS POLICIES
-- ============================================================

-- ── System Config ──
CREATE POLICY "system_config_admin_write" ON system_config
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ── Profiles ──
CREATE POLICY "Authenticated users can read profiles" ON profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can manage profiles" ON profiles
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ── Orders ──
CREATE POLICY "Customers can read own orders" ON orders
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Admins can read all orders" ON orders
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Drivers can read assigned orders" ON orders
  FOR SELECT TO authenticated USING (driver_id = auth.uid() OR is_admin());
CREATE POLICY "Customers can create orders" ON orders
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Admins can create any order" ON orders
  FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Customers can update own pending orders" ON orders
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid() AND status IN (1, 2, 3, 4))
  WITH CHECK (customer_id = auth.uid() AND status IN (1, 2, 3, 4, 13));
CREATE POLICY "Admins can update any order" ON orders
  FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Drivers can update assigned orders" ON orders
  FOR UPDATE TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "Anon can track orders" ON orders
  FOR SELECT TO anon USING (true);

-- ── Order Items ──
CREATE POLICY "Users can read accessible order items" ON order_items
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.customer_id = auth.uid() OR orders.driver_id = auth.uid() OR is_admin())
    )
  );
CREATE POLICY "Users can insert own order items" ON order_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.customer_id = auth.uid() OR is_admin())
    )
  );
CREATE POLICY "Anon can read order_items" ON order_items
  FOR SELECT TO anon USING (true);

-- ── Drivers ──
CREATE POLICY "Authenticated can read drivers" ON drivers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Drivers can update own profile" ON drivers
  FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can manage drivers" ON drivers
  FOR ALL TO authenticated USING (is_admin());

-- ── Driver Routes ──
CREATE POLICY "Drivers can read own routes" ON driver_routes
  FOR SELECT TO authenticated USING (driver_id = auth.uid() OR is_admin());
CREATE POLICY "Admins can manage routes" ON driver_routes
  FOR ALL TO authenticated USING (is_admin());

-- ── Route Stops ──
CREATE POLICY "Users can read accessible route stops" ON route_stops
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM driver_routes
      WHERE driver_routes.id = route_stops.route_id
      AND (driver_routes.driver_id = auth.uid() OR is_admin())
    )
  );
CREATE POLICY "Admins can manage route stops" ON route_stops
  FOR ALL TO authenticated USING (is_admin());

-- ── Warehouse ──
CREATE POLICY "Warehouse staff can read intake" ON warehouse_intake
  FOR SELECT TO authenticated USING (is_warehouse_staff() OR is_admin());
CREATE POLICY "Warehouse staff can manage intake" ON warehouse_intake
  FOR ALL TO authenticated USING (is_warehouse_staff() OR is_admin());
CREATE POLICY "Warehouse staff can read processing" ON warehouse_processing
  FOR SELECT TO authenticated USING (is_warehouse_staff() OR is_admin());
CREATE POLICY "Warehouse staff can manage processing" ON warehouse_processing
  FOR ALL TO authenticated USING (is_warehouse_staff() OR is_admin());
CREATE POLICY "Warehouse staff can read dispatch" ON warehouse_dispatch
  FOR SELECT TO authenticated USING (is_warehouse_staff() OR is_admin());
CREATE POLICY "Warehouse staff can manage dispatch" ON warehouse_dispatch
  FOR ALL TO authenticated USING (is_warehouse_staff() OR is_admin());
CREATE POLICY "Warehouse staff can read quality checks" ON quality_checks
  FOR SELECT TO authenticated USING (is_warehouse_staff() OR is_admin());
CREATE POLICY "Warehouse staff can manage quality checks" ON quality_checks
  FOR ALL TO authenticated USING (is_warehouse_staff() OR is_admin());
CREATE POLICY "Warehouse staff can read stats" ON warehouse_stats
  FOR SELECT TO authenticated USING (is_warehouse_staff() OR is_admin());
CREATE POLICY "Admins can manage warehouse stats" ON warehouse_stats
  FOR ALL TO authenticated USING (is_admin());

-- ── Invoices ──
CREATE POLICY "Customers can read own invoices" ON invoices
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Admins can manage invoices" ON invoices
  FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Users can read accessible invoice items" ON invoice_items
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND (invoices.customer_id = auth.uid() OR is_admin())
    )
  );
CREATE POLICY "Admins can manage invoice items" ON invoice_items
  FOR ALL TO authenticated USING (is_admin());

-- ── Payments (unified) ──
CREATE POLICY "payments_admin_all" ON payments
  FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "payments_customer_read" ON payments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM orders o WHERE o.id = payments.order_id AND o.customer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM invoices inv WHERE inv.id = payments.invoice_id AND inv.customer_id = auth.uid()
    )
  );
CREATE POLICY "payments_driver_read" ON payments
  FOR SELECT TO authenticated USING (is_driver());
CREATE POLICY "payments_driver_insert" ON payments
  FOR INSERT TO authenticated WITH CHECK (is_driver());

-- ── Loyalty ──
CREATE POLICY "Users can read own loyalty account" ON loyalty_accounts
  FOR SELECT TO authenticated USING (customer_id = auth.uid() OR is_admin());
CREATE POLICY "Admins can manage loyalty accounts" ON loyalty_accounts
  FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Users can read own loyalty transactions" ON loyalty_transactions
  FOR SELECT TO authenticated USING (customer_id = auth.uid() OR is_admin());
CREATE POLICY "System can create loyalty transactions" ON loyalty_transactions
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Users can read rewards" ON rewards
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage rewards" ON rewards
  FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Users can read own referrals" ON referrals
  FOR SELECT TO authenticated USING (referrer_id = auth.uid() OR referee_id = auth.uid() OR is_admin());
CREATE POLICY "Users can create referrals" ON referrals
  FOR INSERT TO authenticated WITH CHECK (referrer_id = auth.uid());

-- ── Audit & System Logs ──
CREATE POLICY "Admins can read audit logs" ON audit_logs
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can read system logs" ON system_logs
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "System can insert system logs" ON system_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── Notifications ──
CREATE POLICY "Users can read notification templates" ON notification_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage notification templates" ON notification_templates
  FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Users can read own notification history" ON notification_history
  FOR SELECT TO authenticated USING (recipient_id = auth.uid()::TEXT OR is_admin());
CREATE POLICY "System can create notifications" ON notification_history
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Authenticated insert history" ON notification_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── Driver Performance ──
CREATE POLICY "Drivers can read own performance" ON driver_performance_stats
  FOR SELECT TO authenticated USING (driver_id = auth.uid() OR is_admin());
CREATE POLICY "System can manage performance stats" ON driver_performance_stats
  FOR ALL TO service_role USING (true);
CREATE POLICY "Drivers can read own trends" ON driver_monthly_trends
  FOR SELECT TO authenticated USING (driver_id = auth.uid() OR is_admin());
CREATE POLICY "System can manage monthly trends" ON driver_monthly_trends
  FOR ALL TO service_role USING (true);

-- ── Reports (Admin only) ──
CREATE POLICY "Admins can read kpis" ON report_kpis
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "System can manage kpis" ON report_kpis
  FOR ALL TO service_role USING (true);
CREATE POLICY "Admins can read sales reports" ON report_sales
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "System can manage sales reports" ON report_sales
  FOR ALL TO service_role USING (true);
CREATE POLICY "Admins can read zone performance" ON report_zone_performance
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "System can manage zone performance" ON report_zone_performance
  FOR ALL TO service_role USING (true);
CREATE POLICY "Admins can read revenue by item" ON report_revenue_by_item
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "System can manage revenue by item" ON report_revenue_by_item
  FOR ALL TO service_role USING (true);
CREATE POLICY "Admins can read driver performance report" ON report_driver_performance
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "System can manage driver performance report" ON report_driver_performance
  FOR ALL TO service_role USING (true);
CREATE POLICY "Admins can read demographics" ON report_customer_demographics
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "System can manage demographics" ON report_customer_demographics
  FOR ALL TO service_role USING (true);

-- ============================================================
-- PART 17: FUNCTIONS & TRIGGERS
-- ============================================================

-- ── Auto-update payments timestamp ──
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payments_timestamp ON payments;
CREATE TRIGGER trigger_update_payments_timestamp
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

-- ── Auto-update order payment status on payment completion ──
CREATE OR REPLACE FUNCTION update_order_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE orders
    SET payment_status = 'paid',
        payment_method = NEW.method,
        status = CASE WHEN status = 1 THEN 2 ELSE status END
    WHERE id = NEW.order_id;
  END IF;
  IF NEW.status = 'failed' AND OLD.status != 'failed' THEN
    UPDATE orders
    SET payment_status = 'failed'
    WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_order_on_payment ON payments;
CREATE TRIGGER trigger_update_order_on_payment
  AFTER UPDATE ON payments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_order_payment_status();

-- ── Increment customer orders RPC ──
CREATE OR REPLACE FUNCTION increment_customer_orders(customer_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET total_orders = COALESCE(total_orders, 0) + 1
  WHERE id = customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Auto loyalty account creation on first order ──
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

-- ── Award loyalty points on delivery ──
CREATE OR REPLACE FUNCTION award_loyalty_points_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  points_to_award INTEGER := 50;
BEGIN
  IF NEW.status = 12 AND OLD.status <> 12 AND NEW.customer_id IS NOT NULL THEN
    UPDATE loyalty_accounts
    SET points = points + points_to_award,
        lifetime_points = lifetime_points + points_to_award
    WHERE customer_id = NEW.customer_id;

    INSERT INTO loyalty_transactions (customer_id, points, type, description, order_id, balance_after)
    SELECT
      NEW.customer_id, points_to_award, 'earned',
      'Points earned for completed order ' || NEW.tracking_code,
      NEW.tracking_code, la.points
    FROM loyalty_accounts la WHERE la.customer_id = NEW.customer_id;

    UPDATE profiles
    SET loyalty_points = COALESCE(loyalty_points, 0) + points_to_award,
        total_spent = COALESCE(total_spent, 0) + COALESCE(NEW.total, 0)
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER award_loyalty_on_delivery
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_points_on_delivery();

-- ── Atomic payment completion function ──
CREATE OR REPLACE FUNCTION complete_payment_transaction(
  p_payment_id UUID,
  p_order_id UUID,
  p_transaction_id TEXT,
  p_result_code INTEGER,
  p_result_desc TEXT
) RETURNS JSONB AS $$
DECLARE
  v_payment_status TEXT;
BEGIN
  IF p_result_code = 0 THEN
    v_payment_status := 'completed';
  ELSE
    v_payment_status := 'failed';
  END IF;

  UPDATE payments
  SET
    status = v_payment_status::payment_status,
    transaction_id = p_transaction_id,
    result_code = p_result_code,
    result_desc = p_result_desc,
    completed_at = CASE WHEN p_result_code = 0 THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_payment_id;

  IF v_payment_status = 'completed' AND p_order_id IS NOT NULL THEN
    UPDATE orders
    SET payment_status = 'paid', updated_at = NOW()
    WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_status', v_payment_status,
    'order_updated', v_payment_status = 'completed'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Idempotent payment callback processor ──
CREATE OR REPLACE FUNCTION process_payment_callback(
  p_checkout_request_id TEXT,
  p_merchant_request_id TEXT,
  p_result_code INTEGER,
  p_result_desc TEXT,
  p_amount NUMERIC,
  p_mpesa_receipt_number TEXT
) RETURNS JSONB AS $$
DECLARE
  v_payment RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_payment
  FROM payments
  WHERE checkout_request_id = p_checkout_request_id;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Payment not found',
      'checkout_request_id', p_checkout_request_id
    );
  END IF;

  IF v_payment.status IN ('completed', 'failed', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', true, 'message', 'Payment already processed (idempotent)',
      'status', v_payment.status, 'idempotent', true
    );
  END IF;

  IF p_amount IS NOT NULL AND ABS(v_payment.amount - p_amount) > 0.01 THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Amount mismatch',
      'expected', v_payment.amount, 'received', p_amount
    );
  END IF;

  SELECT * INTO v_result
  FROM complete_payment_transaction(
    v_payment.id, v_payment.order_id,
    p_mpesa_receipt_number, p_result_code, p_result_desc
  );

  v_result := v_result || jsonb_build_object('idempotent', false);
  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Audit trigger function (correct column names) ──
CREATE OR REPLACE FUNCTION audit_sensitive_update()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    timestamp, user_id, user_name, user_role,
    action, entity, entity_id, details, ip_address
  ) VALUES (
    now(),
    COALESCE(auth.uid()::TEXT, 'system'),
    COALESCE((SELECT name FROM profiles WHERE id = auth.uid()), 'system'),
    COALESCE((SELECT role::TEXT FROM profiles WHERE id = auth.uid()), 'system'),
    TG_OP || '_' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    NEW.id::TEXT,
    jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))::TEXT,
    'db-trigger'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_payments_update ON payments;
CREATE TRIGGER audit_payments_update
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION audit_sensitive_update();

DROP TRIGGER IF EXISTS audit_orders_status_change ON orders;
CREATE TRIGGER audit_orders_status_change
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION audit_sensitive_update();

-- ── Payment views ──
CREATE OR REPLACE VIEW recent_payments AS
SELECT
  p.id, p.order_id, o.tracking_code, p.amount, p.method, p.status,
  p.transaction_id, p.phone_number, p.created_at, p.completed_at,
  pr.name as customer_name, pr.email as customer_email
FROM payments p
LEFT JOIN orders o ON p.order_id = o.id
LEFT JOIN profiles pr ON o.customer_id = pr.id
ORDER BY p.created_at DESC;

CREATE OR REPLACE VIEW payment_stats AS
SELECT
  COUNT(*) as total_transactions,
  COUNT(*) FILTER (WHERE status = 'completed') as successful_transactions,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_transactions,
  COUNT(*) FILTER (WHERE status = 'processing') as pending_transactions,
  SUM(amount) FILTER (WHERE status = 'completed') as total_revenue,
  AVG(amount) FILTER (WHERE status = 'completed') as average_transaction,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'completed')::numeric /
    NULLIF(COUNT(*), 0) * 100, 2
  ) as success_rate_percentage
FROM payments
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- ── Payment utility functions ──
CREATE OR REPLACE FUNCTION get_payment_by_checkout_request_id(checkout_id TEXT)
RETURNS TABLE (
  id UUID, order_id UUID, amount NUMERIC, status payment_status, transaction_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.order_id, p.amount, p.status, p.transaction_id
  FROM payments p WHERE p.checkout_request_id = checkout_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION verify_payment_for_order(p_order_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM payments WHERE order_id = p_order_id AND status = 'completed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 18: VERIFICATION
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  expected_tables TEXT[] := ARRAY[
    'system_config', 'profiles', 'orders', 'order_items',
    'drivers', 'driver_routes', 'route_stops',
    'warehouse_intake', 'warehouse_processing', 'warehouse_dispatch',
    'quality_checks', 'warehouse_stats',
    'invoices', 'invoice_items', 'payments',
    'loyalty_accounts', 'loyalty_transactions', 'rewards', 'referrals',
    'audit_logs', 'system_logs',
    'notification_templates', 'notification_history',
    'driver_performance_stats', 'driver_monthly_trends',
    'report_kpis', 'report_sales', 'report_zone_performance',
    'report_revenue_by_item', 'report_driver_performance', 'report_customer_demographics'
  ];
BEGIN
  FOREACH tbl IN ARRAY expected_tables LOOP
    ASSERT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ), 'MISSING TABLE: ' || tbl;
  END LOOP;
  RAISE NOTICE '✓ All 31 base tables created';

  ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin'), 'MISSING FUNCTION: is_admin()';
  ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_driver'), 'MISSING FUNCTION: is_driver()';
  ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_warehouse_staff'), 'MISSING FUNCTION: is_warehouse_staff()';
  ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_payment_callback'), 'MISSING FUNCTION: process_payment_callback()';
  RAISE NOTICE '✓ All helper functions created';

  RAISE NOTICE '✓ Init script complete — proceed to Phase 4 migrations';
END $$;
