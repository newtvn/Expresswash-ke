-- ============================================================
-- ExpressWash Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── Custom types ──────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('customer', 'driver', 'warehouse_staff', 'admin', 'super_admin');
CREATE TYPE loyalty_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum');
CREATE TYPE order_status AS ENUM ('cancelled', 'pending', 'driver_assigned', 'picked_up', 'at_warehouse', 'processing', 'quality_check', 'ready_for_delivery', 'out_for_delivery', 'delivered');
CREATE TYPE processing_stage AS ENUM ('intake', 'washing', 'drying', 'quality_check', 'ready_for_dispatch');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled');
CREATE TYPE payment_method AS ENUM ('mpesa', 'cash', 'card', 'bank_transfer');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE notification_channel AS ENUM ('sms', 'email', 'whatsapp', 'push');
CREATE TYPE notification_status AS ENUM ('sent', 'delivered', 'failed', 'pending');
CREATE TYPE driver_status AS ENUM ('available', 'on_route', 'on_break', 'offline');
CREATE TYPE route_status AS ENUM ('planned', 'in_progress', 'completed');
CREATE TYPE route_stop_type AS ENUM ('pickup', 'delivery');
CREATE TYPE route_stop_status AS ENUM ('pending', 'completed', 'skipped');
CREATE TYPE loyalty_transaction_type AS ENUM ('earned', 'redeemed', 'expired', 'bonus', 'adjustment');
CREATE TYPE referral_status AS ENUM ('pending', 'completed', 'expired');
CREATE TYPE log_level AS ENUM ('info', 'warn', 'error', 'debug');

-- ── Profiles (extends Supabase auth.users) ────────────────────
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
  total_spent NUMERIC(12,2) DEFAULT 0
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

-- ── Orders ────────────────────────────────────────────────────
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1
);

-- ── Drivers ───────────────────────────────────────────────────
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
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Driver Routes ─────────────────────────────────────────────
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

-- ── Warehouse ─────────────────────────────────────────────────
CREATE TABLE warehouse_intake (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
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
  order_id TEXT NOT NULL,
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
  days_in_warehouse INTEGER DEFAULT 0
);

CREATE TABLE warehouse_dispatch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
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

-- ── Invoices ──────────────────────────────────────────────────
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  order_id TEXT NOT NULL,
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
  pdf_url TEXT
);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  invoice_number TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  method payment_method NOT NULL,
  reference TEXT NOT NULL,
  mpesa_receipt_number TEXT,
  status payment_status NOT NULL DEFAULT 'pending',
  recorded_by TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Loyalty ───────────────────────────────────────────────────
CREATE TABLE loyalty_accounts (
  customer_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  tier loyalty_tier NOT NULL DEFAULT 'bronze',
  tier_progress INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  next_tier loyalty_tier,
  points_to_next_tier INTEGER
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

-- ── Audit Logs ────────────────────────────────────────────────
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

-- ── Notification Templates ────────────────────────────────────
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
  failure_reason TEXT
);

-- ── Driver Performance Stats ──────────────────────────────────
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
  customer_complaints INTEGER DEFAULT 0
);

CREATE TABLE driver_monthly_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  deliveries INTEGER NOT NULL DEFAULT 0,
  on_time_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ── Report data tables ────────────────────────────────────────
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

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_zone ON profiles(zone);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);
CREATE INDEX idx_orders_tracking_code ON orders(tracking_code);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_zone ON orders(zone);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_notification_history_recipient ON notification_history(recipient_id);

-- ── Row Level Security ────────────────────────────────────────
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

-- ── RLS Policies ──────────────────────────────────────────────
-- For initial development, allow authenticated users full access.
-- Tighten these policies for production.

CREATE POLICY "Authenticated users can read profiles" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Admins can manage profiles" ON profiles
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

-- Orders: everyone authenticated can read, admins can write
CREATE POLICY "Authenticated read orders" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert orders" ON orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update orders" ON orders FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated read order_items" ON order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert order_items" ON order_items FOR INSERT TO authenticated WITH CHECK (true);

-- Drivers
CREATE POLICY "Authenticated read drivers" ON drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage drivers" ON drivers FOR ALL TO authenticated USING (true);

-- Routes
CREATE POLICY "Authenticated read routes" ON driver_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage routes" ON driver_routes FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read stops" ON route_stops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage stops" ON route_stops FOR ALL TO authenticated USING (true);

-- Warehouse
CREATE POLICY "Authenticated read warehouse_intake" ON warehouse_intake FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage warehouse_intake" ON warehouse_intake FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read warehouse_processing" ON warehouse_processing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage warehouse_processing" ON warehouse_processing FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read warehouse_dispatch" ON warehouse_dispatch FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage warehouse_dispatch" ON warehouse_dispatch FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read quality_checks" ON quality_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage quality_checks" ON quality_checks FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read warehouse_stats" ON warehouse_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage warehouse_stats" ON warehouse_stats FOR ALL TO authenticated USING (true);

-- Invoices
CREATE POLICY "Authenticated read invoices" ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage invoices" ON invoices FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read invoice_items" ON invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage invoice_items" ON invoice_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read payments" ON payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage payments" ON payments FOR ALL TO authenticated USING (true);

-- Loyalty
CREATE POLICY "Authenticated read loyalty_accounts" ON loyalty_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage loyalty_accounts" ON loyalty_accounts FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read loyalty_transactions" ON loyalty_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage loyalty_transactions" ON loyalty_transactions FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read rewards" ON rewards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage rewards" ON rewards FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read referrals" ON referrals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage referrals" ON referrals FOR ALL TO authenticated USING (true);

-- Audit & System Logs
CREATE POLICY "Authenticated read audit_logs" ON audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert audit_logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated read system_logs" ON system_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert system_logs" ON system_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Notifications
CREATE POLICY "Authenticated read templates" ON notification_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage templates" ON notification_templates FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read history" ON notification_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage history" ON notification_history FOR ALL TO authenticated USING (true);

-- Driver Performance
CREATE POLICY "Authenticated read perf stats" ON driver_performance_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage perf stats" ON driver_performance_stats FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read monthly trends" ON driver_monthly_trends FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage monthly trends" ON driver_monthly_trends FOR ALL TO authenticated USING (true);

-- Reports
CREATE POLICY "Authenticated read kpis" ON report_kpis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage kpis" ON report_kpis FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read sales" ON report_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage sales" ON report_sales FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read zone_perf" ON report_zone_performance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage zone_perf" ON report_zone_performance FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read rev_item" ON report_revenue_by_item FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage rev_item" ON report_revenue_by_item FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read driver_perf" ON report_driver_performance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage driver_perf" ON report_driver_performance FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated read demographics" ON report_customer_demographics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage demographics" ON report_customer_demographics FOR ALL TO authenticated USING (true);

-- Allow anon access to orders for public tracking
CREATE POLICY "Anon can track orders" ON orders FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can read order_items" ON order_items FOR SELECT TO anon USING (true);
