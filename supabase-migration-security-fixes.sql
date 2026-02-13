-- ============================================================
-- SECURITY MIGRATION: Fix Critical RLS Policies
-- ============================================================
-- This migration addresses critical security vulnerabilities:
-- 1. Overly permissive RLS policies (USING true)
-- 2. Missing foreign key constraints
-- 3. Missing CHECK constraints
-- 4. Transaction management for payments
--
-- Run this BEFORE going to production
-- ============================================================

-- ============================================================
-- PART 1: DROP OVERLY PERMISSIVE RLS POLICIES
-- ============================================================

-- Drop all existing permissive policies
DROP POLICY IF EXISTS "Authenticated read orders" ON orders;
DROP POLICY IF EXISTS "Authenticated insert orders" ON orders;
DROP POLICY IF EXISTS "Authenticated update orders" ON orders;
DROP POLICY IF EXISTS "Authenticated read order_items" ON order_items;
DROP POLICY IF EXISTS "Authenticated insert order_items" ON order_items;

DROP POLICY IF EXISTS "Authenticated read drivers" ON drivers;
DROP POLICY IF EXISTS "Authenticated manage drivers" ON drivers;

DROP POLICY IF EXISTS "Authenticated read routes" ON driver_routes;
DROP POLICY IF EXISTS "Authenticated manage routes" ON driver_routes;
DROP POLICY IF EXISTS "Authenticated read stops" ON route_stops;
DROP POLICY IF EXISTS "Authenticated manage stops" ON route_stops;

DROP POLICY IF EXISTS "Authenticated read warehouse_intake" ON warehouse_intake;
DROP POLICY IF EXISTS "Authenticated manage warehouse_intake" ON warehouse_intake;
DROP POLICY IF EXISTS "Authenticated read warehouse_processing" ON warehouse_processing;
DROP POLICY IF EXISTS "Authenticated manage warehouse_processing" ON warehouse_processing;
DROP POLICY IF EXISTS "Authenticated read warehouse_dispatch" ON warehouse_dispatch;
DROP POLICY IF EXISTS "Authenticated manage warehouse_dispatch" ON warehouse_dispatch;
DROP POLICY IF EXISTS "Authenticated read quality_checks" ON quality_checks;
DROP POLICY IF EXISTS "Authenticated manage quality_checks" ON quality_checks;
DROP POLICY IF EXISTS "Authenticated read warehouse_stats" ON warehouse_stats;
DROP POLICY IF EXISTS "Authenticated manage warehouse_stats" ON warehouse_stats;

DROP POLICY IF EXISTS "Authenticated read invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated manage invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated read invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Authenticated manage invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Authenticated read payments" ON payments;
DROP POLICY IF EXISTS "Authenticated manage payments" ON payments;

DROP POLICY IF EXISTS "Authenticated read loyalty_accounts" ON loyalty_accounts;
DROP POLICY IF EXISTS "Authenticated manage loyalty_accounts" ON loyalty_accounts;
DROP POLICY IF EXISTS "Authenticated read loyalty_transactions" ON loyalty_transactions;
DROP POLICY IF EXISTS "Authenticated manage loyalty_transactions" ON loyalty_transactions;
DROP POLICY IF EXISTS "Authenticated read rewards" ON rewards;
DROP POLICY IF EXISTS "Authenticated manage rewards" ON rewards;
DROP POLICY IF EXISTS "Authenticated read referrals" ON referrals;
DROP POLICY IF EXISTS "Authenticated manage referrals" ON referrals;

DROP POLICY IF EXISTS "Authenticated read audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Authenticated insert audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Authenticated read system_logs" ON system_logs;
DROP POLICY IF EXISTS "Authenticated insert system_logs" ON system_logs;

DROP POLICY IF EXISTS "Authenticated read templates" ON notification_templates;
DROP POLICY IF EXISTS "Authenticated manage templates" ON notification_templates;
DROP POLICY IF EXISTS "Authenticated read history" ON notification_history;
DROP POLICY IF EXISTS "Authenticated manage history" ON notification_history;

DROP POLICY IF EXISTS "Authenticated read perf stats" ON driver_performance_stats;
DROP POLICY IF EXISTS "Authenticated manage perf stats" ON driver_performance_stats;
DROP POLICY IF EXISTS "Authenticated read monthly trends" ON driver_monthly_trends;
DROP POLICY IF EXISTS "Authenticated manage monthly trends" ON driver_monthly_trends;

DROP POLICY IF EXISTS "Authenticated read kpis" ON report_kpis;
DROP POLICY IF EXISTS "Authenticated manage kpis" ON report_kpis;
DROP POLICY IF EXISTS "Authenticated read sales" ON report_sales;
DROP POLICY IF EXISTS "Authenticated manage sales" ON report_sales;
DROP POLICY IF EXISTS "Authenticated read zone_perf" ON report_zone_performance;
DROP POLICY IF EXISTS "Authenticated manage zone_perf" ON report_zone_performance;
DROP POLICY IF EXISTS "Authenticated read rev_item" ON report_revenue_by_item;
DROP POLICY IF EXISTS "Authenticated manage rev_item" ON report_revenue_by_item;
DROP POLICY IF EXISTS "Authenticated read driver_perf" ON report_driver_performance;
DROP POLICY IF EXISTS "Authenticated manage driver_perf" ON report_driver_performance;
DROP POLICY IF EXISTS "Authenticated read demographics" ON report_customer_demographics;
DROP POLICY IF EXISTS "Authenticated manage demographics" ON report_customer_demographics;

-- ============================================================
-- PART 2: HELPER FUNCTIONS FOR ROLE CHECKING
-- ============================================================

-- Check if user is admin or super_admin
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

-- Check if user is driver
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

-- Check if user is warehouse staff
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
-- PART 3: CREATE SECURE RLS POLICIES - ORDERS
-- ============================================================

-- Customers can read their own orders
CREATE POLICY "Customers can read own orders" ON orders
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

-- Admins can read all orders
CREATE POLICY "Admins can read all orders" ON orders
  FOR SELECT TO authenticated
  USING (is_admin());

-- Drivers can read their assigned orders
CREATE POLICY "Drivers can read assigned orders" ON orders
  FOR SELECT TO authenticated
  USING (
    driver_id = auth.uid()
    OR is_admin()
  );

-- Customers can create their own orders
CREATE POLICY "Customers can create orders" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- Admins can create any order
CREATE POLICY "Admins can create any order" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- Customers can update their own pending orders
CREATE POLICY "Customers can update own pending orders" ON orders
  FOR UPDATE TO authenticated
  USING (
    customer_id = auth.uid()
    AND status IN (0, 1)  -- Only pending or confirmed
  );

-- Admins can update any order
CREATE POLICY "Admins can update any order" ON orders
  FOR UPDATE TO authenticated
  USING (is_admin());

-- Drivers can update their assigned orders
CREATE POLICY "Drivers can update assigned orders" ON orders
  FOR UPDATE TO authenticated
  USING (
    driver_id = auth.uid()
    AND status IN (2, 3, 4)  -- Processing, in-transit, delivered
  );

-- ============================================================
-- PART 4: ORDER ITEMS
-- ============================================================

-- Users can read order items for orders they can access
CREATE POLICY "Users can read accessible order items" ON order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (
        orders.customer_id = auth.uid()
        OR orders.driver_id = auth.uid()
        OR is_admin()
      )
    )
  );

-- Users can insert order items for their own orders
CREATE POLICY "Users can insert own order items" ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (
        orders.customer_id = auth.uid()
        OR is_admin()
      )
    )
  );

-- ============================================================
-- PART 5: PAYMENTS (HIGHLY SENSITIVE)
-- ============================================================

-- Customers can read their own payments
CREATE POLICY "Customers can read own payments" ON payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
      AND orders.customer_id = auth.uid()
    )
  );

-- Admins can read all payments
CREATE POLICY "Admins can read all payments" ON payments
  FOR SELECT TO authenticated
  USING (is_admin());

-- Only backend (service_role) can create payments
-- This prevents customers from creating fake payment records
CREATE POLICY "Service role can create payments" ON payments
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Only backend (service_role) can update payments
-- This prevents tampering with payment status
CREATE POLICY "Service role can update payments" ON payments
  FOR UPDATE TO service_role
  USING (true);

-- Admins can update payments (for refunds/corrections)
CREATE POLICY "Admins can update payments" ON payments
  FOR UPDATE TO authenticated
  USING (is_admin());

-- ============================================================
-- PART 6: DRIVERS
-- ============================================================

-- All authenticated users can read driver info (for assignment UI)
CREATE POLICY "Authenticated can read drivers" ON drivers
  FOR SELECT TO authenticated
  USING (true);

-- Drivers can update their own profile
CREATE POLICY "Drivers can update own profile" ON drivers
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Admins can manage all drivers
CREATE POLICY "Admins can manage drivers" ON drivers
  FOR ALL TO authenticated
  USING (is_admin());

-- ============================================================
-- PART 7: DRIVER ROUTES & STOPS
-- ============================================================

-- Drivers can read their own routes
CREATE POLICY "Drivers can read own routes" ON driver_routes
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid() OR is_admin());

-- Admins can manage all routes
CREATE POLICY "Admins can manage routes" ON driver_routes
  FOR ALL TO authenticated
  USING (is_admin());

-- Users can read route stops for accessible routes
CREATE POLICY "Users can read accessible route stops" ON route_stops
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM driver_routes
      WHERE driver_routes.id = route_stops.route_id
      AND (driver_routes.driver_id = auth.uid() OR is_admin())
    )
  );

-- Admins can manage route stops
CREATE POLICY "Admins can manage route stops" ON route_stops
  FOR ALL TO authenticated
  USING (is_admin());

-- ============================================================
-- PART 8: WAREHOUSE OPERATIONS
-- ============================================================

-- Warehouse staff and admins can read warehouse tables
CREATE POLICY "Warehouse staff can read intake" ON warehouse_intake
  FOR SELECT TO authenticated
  USING (is_warehouse_staff() OR is_admin());

CREATE POLICY "Warehouse staff can manage intake" ON warehouse_intake
  FOR ALL TO authenticated
  USING (is_warehouse_staff() OR is_admin());

CREATE POLICY "Warehouse staff can read processing" ON warehouse_processing
  FOR SELECT TO authenticated
  USING (is_warehouse_staff() OR is_admin());

CREATE POLICY "Warehouse staff can manage processing" ON warehouse_processing
  FOR ALL TO authenticated
  USING (is_warehouse_staff() OR is_admin());

CREATE POLICY "Warehouse staff can read dispatch" ON warehouse_dispatch
  FOR SELECT TO authenticated
  USING (is_warehouse_staff() OR is_admin());

CREATE POLICY "Warehouse staff can manage dispatch" ON warehouse_dispatch
  FOR ALL TO authenticated
  USING (is_warehouse_staff() OR is_admin());

CREATE POLICY "Warehouse staff can read quality checks" ON quality_checks
  FOR SELECT TO authenticated
  USING (is_warehouse_staff() OR is_admin());

CREATE POLICY "Warehouse staff can manage quality checks" ON quality_checks
  FOR ALL TO authenticated
  USING (is_warehouse_staff() OR is_admin());

CREATE POLICY "Warehouse staff can read stats" ON warehouse_stats
  FOR SELECT TO authenticated
  USING (is_warehouse_staff() OR is_admin());

CREATE POLICY "Admins can manage warehouse stats" ON warehouse_stats
  FOR ALL TO authenticated
  USING (is_admin());

-- ============================================================
-- PART 9: INVOICES
-- ============================================================

-- Customers can read their own invoices
CREATE POLICY "Customers can read own invoices" ON invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = invoices.order_id
      AND orders.customer_id = auth.uid()
    )
  );

-- Admins can manage all invoices
CREATE POLICY "Admins can manage invoices" ON invoices
  FOR ALL TO authenticated
  USING (is_admin());

-- Users can read invoice items for accessible invoices
CREATE POLICY "Users can read accessible invoice items" ON invoice_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN orders ON orders.id = invoices.order_id
      WHERE invoices.id = invoice_items.invoice_id
      AND (orders.customer_id = auth.uid() OR is_admin())
    )
  );

-- Admins can manage invoice items
CREATE POLICY "Admins can manage invoice items" ON invoice_items
  FOR ALL TO authenticated
  USING (is_admin());

-- ============================================================
-- PART 10: LOYALTY & REFERRALS
-- ============================================================

-- Users can read their own loyalty account
CREATE POLICY "Users can read own loyalty account" ON loyalty_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- System can manage loyalty accounts
CREATE POLICY "Admins can manage loyalty accounts" ON loyalty_accounts
  FOR ALL TO authenticated
  USING (is_admin());

-- Users can read their own loyalty transactions
CREATE POLICY "Users can read own loyalty transactions" ON loyalty_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- System can create loyalty transactions
CREATE POLICY "System can create loyalty transactions" ON loyalty_transactions
  FOR INSERT TO service_role
  WITH CHECK (true);

-- All users can read available rewards
CREATE POLICY "Users can read rewards" ON rewards
  FOR SELECT TO authenticated
  USING (true);

-- Admins can manage rewards
CREATE POLICY "Admins can manage rewards" ON rewards
  FOR ALL TO authenticated
  USING (is_admin());

-- Users can read their own referrals
CREATE POLICY "Users can read own referrals" ON referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR is_admin());

-- Users can create referrals
CREATE POLICY "Users can create referrals" ON referrals
  FOR INSERT TO authenticated
  WITH CHECK (referrer_id = auth.uid());

-- ============================================================
-- PART 11: AUDIT LOGS (Read-Only for Users)
-- ============================================================

-- Admins can read audit logs
CREATE POLICY "Admins can read audit logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (is_admin());

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Admins can read system logs
CREATE POLICY "Admins can read system logs" ON system_logs
  FOR SELECT TO authenticated
  USING (is_admin());

-- System can insert system logs
CREATE POLICY "System can insert system logs" ON system_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- PART 12: NOTIFICATIONS
-- ============================================================

-- All users can read notification templates
CREATE POLICY "Users can read notification templates" ON notification_templates
  FOR SELECT TO authenticated
  USING (true);

-- Admins can manage templates
CREATE POLICY "Admins can manage notification templates" ON notification_templates
  FOR ALL TO authenticated
  USING (is_admin());

-- Users can read their own notification history
CREATE POLICY "Users can read own notification history" ON notification_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- System can create notifications
CREATE POLICY "System can create notifications" ON notification_history
  FOR INSERT TO service_role
  WITH CHECK (true);

-- ============================================================
-- PART 13: DRIVER PERFORMANCE
-- ============================================================

-- Drivers can read their own performance
CREATE POLICY "Drivers can read own performance" ON driver_performance_stats
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid() OR is_admin());

-- System updates performance stats
CREATE POLICY "System can manage performance stats" ON driver_performance_stats
  FOR ALL TO service_role
  USING (true);

-- Drivers can read their own monthly trends
CREATE POLICY "Drivers can read own trends" ON driver_monthly_trends
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid() OR is_admin());

-- System updates monthly trends
CREATE POLICY "System can manage monthly trends" ON driver_monthly_trends
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- PART 14: REPORTS (Admin Only)
-- ============================================================

CREATE POLICY "Admins can read kpis" ON report_kpis
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "System can manage kpis" ON report_kpis
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "Admins can read sales reports" ON report_sales
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "System can manage sales reports" ON report_sales
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "Admins can read zone performance" ON report_zone_performance
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "System can manage zone performance" ON report_zone_performance
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "Admins can read revenue by item" ON report_revenue_by_item
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "System can manage revenue by item" ON report_revenue_by_item
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "Admins can read driver performance report" ON report_driver_performance
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "System can manage driver performance report" ON report_driver_performance
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "Admins can read demographics" ON report_customer_demographics
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "System can manage demographics" ON report_customer_demographics
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- PART 15: ADD MISSING FOREIGN KEY CONSTRAINTS
-- ============================================================

-- Convert warehouse table order_id from TEXT to UUID and add FK
-- Note: This assumes order_id values are valid UUIDs. Clean data first if needed.

DO $$
BEGIN
  -- Check if order_id is TEXT type, then convert
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_intake'
    AND column_name = 'order_id'
    AND data_type = 'text'
  ) THEN
    ALTER TABLE warehouse_intake
      ALTER COLUMN order_id TYPE UUID USING order_id::UUID;
  END IF;
END $$;

ALTER TABLE warehouse_intake
  DROP CONSTRAINT IF EXISTS fk_warehouse_intake_order,
  ADD CONSTRAINT fk_warehouse_intake_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_processing'
    AND column_name = 'order_id'
    AND data_type = 'text'
  ) THEN
    ALTER TABLE warehouse_processing
      ALTER COLUMN order_id TYPE UUID USING order_id::UUID;
  END IF;
END $$;

ALTER TABLE warehouse_processing
  DROP CONSTRAINT IF EXISTS fk_warehouse_processing_order,
  ADD CONSTRAINT fk_warehouse_processing_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_dispatch'
    AND column_name = 'order_id'
    AND data_type = 'text'
  ) THEN
    ALTER TABLE warehouse_dispatch
      ALTER COLUMN order_id TYPE UUID USING order_id::UUID;
  END IF;
END $$;

ALTER TABLE warehouse_dispatch
  DROP CONSTRAINT IF EXISTS fk_warehouse_dispatch_order,
  ADD CONSTRAINT fk_warehouse_dispatch_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- ============================================================
-- PART 16: ADD CHECK CONSTRAINTS FOR DATA VALIDATION
-- ============================================================

-- Driver rating should be 0-5
ALTER TABLE drivers
  DROP CONSTRAINT IF EXISTS check_driver_rating,
  ADD CONSTRAINT check_driver_rating CHECK (rating >= 0 AND rating <= 5);

-- Driver performance on_time_rate should be 0-100
ALTER TABLE driver_performance_stats
  DROP CONSTRAINT IF EXISTS check_on_time_rate,
  ADD CONSTRAINT check_on_time_rate CHECK (on_time_rate >= 0 AND on_time_rate <= 100);

-- Loyalty points should be non-negative
ALTER TABLE loyalty_accounts
  DROP CONSTRAINT IF EXISTS check_loyalty_points,
  ADD CONSTRAINT check_loyalty_points CHECK (points >= 0);

ALTER TABLE loyalty_accounts
  DROP CONSTRAINT IF EXISTS check_lifetime_points,
  ADD CONSTRAINT check_lifetime_points CHECK (lifetime_points >= 0);

-- Payment amount must be positive
-- (Already exists in migration-payments.sql but adding for completeness)
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS check_payment_amount,
  ADD CONSTRAINT check_payment_amount CHECK (amount > 0);

-- Order status should be valid (0-6)
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS check_order_status,
  ADD CONSTRAINT check_order_status CHECK (status >= 0 AND status <= 6);

-- ============================================================
-- PART 17: CREATE STORED PROCEDURE FOR ATOMIC PAYMENT COMPLETION
-- ============================================================

-- This function ensures payment and order updates happen atomically
CREATE OR REPLACE FUNCTION complete_payment_transaction(
  p_payment_id UUID,
  p_order_id UUID,
  p_transaction_id TEXT,
  p_result_code INTEGER,
  p_result_desc TEXT
) RETURNS JSONB AS $$
DECLARE
  v_payment_status TEXT;
  v_order_status INTEGER;
BEGIN
  -- Determine payment status
  IF p_result_code = 0 THEN
    v_payment_status := 'completed';
    v_order_status := 2; -- Processing
  ELSE
    v_payment_status := 'failed';
    -- Order status stays unchanged
    v_order_status := NULL;
  END IF;

  -- Update payment record
  UPDATE payments
  SET
    status = v_payment_status::payment_status,
    transaction_id = p_transaction_id,
    result_code = p_result_code,
    result_desc = p_result_desc,
    completed_at = CASE WHEN p_result_code = 0 THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_payment_id;

  -- Update order if payment successful
  IF v_order_status IS NOT NULL THEN
    UPDATE orders
    SET
      payment_status = 'paid',
      status = v_order_status,
      updated_at = NOW()
    WHERE id = p_order_id;
  END IF;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'payment_status', v_payment_status,
    'order_updated', v_order_status IS NOT NULL
  );

EXCEPTION WHEN OTHERS THEN
  -- Return error
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 18: CREATE FUNCTION FOR IDEMPOTENT PAYMENT CALLBACK
-- ============================================================

-- This function prevents duplicate payment processing (replay attacks)
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
  -- Find payment by checkout_request_id
  SELECT * INTO v_payment
  FROM payments
  WHERE checkout_request_id = p_checkout_request_id;

  -- If payment not found, return error
  IF v_payment IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment not found',
      'checkout_request_id', p_checkout_request_id
    );
  END IF;

  -- IDEMPOTENCY CHECK: If already completed/failed, return success without updating
  IF v_payment.status IN ('completed', 'failed', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Payment already processed (idempotent)',
      'status', v_payment.status,
      'idempotent', true
    );
  END IF;

  -- Amount validation
  IF ABS(v_payment.amount - p_amount) > 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount mismatch',
      'expected', v_payment.amount,
      'received', p_amount
    );
  END IF;

  -- Process payment using atomic transaction function
  SELECT * INTO v_result
  FROM complete_payment_transaction(
    v_payment.id,
    v_payment.order_id,
    p_mpesa_receipt_number,
    p_result_code,
    p_result_desc
  );

  -- Add callback details to result
  v_result := v_result || jsonb_build_object('idempotent', false);

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 19: ADD UNIQUE CONSTRAINT TO PREVENT DUPLICATE TRANSACTIONS
-- ============================================================

-- Ensure transaction_id is unique (prevents duplicate payments)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_transaction_id
  ON payments(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- ============================================================
-- PART 20: CREATE AUDIT TRIGGER FOR SENSITIVE OPERATIONS
-- ============================================================

-- Function to log sensitive updates
CREATE OR REPLACE FUNCTION audit_sensitive_update()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    timestamp
  ) VALUES (
    auth.uid(),
    TG_OP || '_' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    NEW.id::TEXT,
    jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    ),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit triggers to sensitive tables
DROP TRIGGER IF EXISTS audit_payments_update ON payments;
CREATE TRIGGER audit_payments_update
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION audit_sensitive_update();

DROP TRIGGER IF EXISTS audit_orders_status_change ON orders;
CREATE TRIGGER audit_orders_status_change
  AFTER UPDATE OF status, payment_status ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.payment_status IS DISTINCT FROM NEW.payment_status)
  EXECUTE FUNCTION audit_sensitive_update();

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

-- Verify RLS is enabled on all tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Summary
SELECT 'Security migration completed successfully!' AS status;
SELECT 'RLS policies updated to role-based access control' AS rls_status;
SELECT 'Foreign key constraints added to warehouse tables' AS fk_status;
SELECT 'CHECK constraints added for data validation' AS check_status;
SELECT 'Atomic payment transaction functions created' AS transaction_status;
SELECT 'Idempotent callback processing implemented' AS idempotency_status;
SELECT 'Audit logging enabled for sensitive operations' AS audit_status;
