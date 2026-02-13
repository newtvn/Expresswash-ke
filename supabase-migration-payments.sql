-- ============================================================
-- ExpressWash - Payment System Migration
-- Run this in Supabase SQL Editor to add payment functionality
-- ============================================================

-- ── Create payment_method and payment_status types if not exist ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('mpesa', 'cash', 'card', 'bank_transfer', 'qr_code');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled');
  END IF;
END $$;

-- ── Payments Table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,

  -- Payment details
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  method payment_method NOT NULL DEFAULT 'mpesa',
  status payment_status NOT NULL DEFAULT 'pending',

  -- Customer details
  phone_number TEXT,
  customer_name TEXT,

  -- M-Pesa/STK Push details
  transaction_id TEXT, -- M-Pesa receipt number (e.g., QGR7I8K9LM)
  merchant_request_id TEXT,
  checkout_request_id TEXT UNIQUE,

  -- Bank/payment provider details
  reference_number TEXT,

  -- Response from payment provider
  result_code INTEGER,
  result_desc TEXT,
  failure_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ── Indexes for Performance ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_checkout_request_id ON payments(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(method);

-- ── Add payment_status to orders table if not exists ───────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'unpaid';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_method payment_method DEFAULT 'cash';
  END IF;
END $$;

-- ── Auto-update timestamp trigger ──────────────────────────────
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

-- ── Auto-update order payment status trigger ───────────────────
CREATE OR REPLACE FUNCTION update_order_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When payment is completed, update order
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE orders
    SET
      payment_status = 'paid',
      payment_method = NEW.method,
      -- Move to next stage if still pending
      status = CASE
        WHEN status = 1 THEN 2  -- pending -> driver_assigned
        ELSE status
      END
    WHERE id = NEW.order_id;
  END IF;

  -- When payment fails, mark order
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

-- ── Row Level Security (RLS) ────────────────────────────────────
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Customers can view their own payments
CREATE POLICY "Customers can view own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN profiles p ON o.customer_id = p.id
      WHERE o.id = payments.order_id
        AND p.id = auth.uid()
    )
  );

-- Admin/super_admin can view all payments
CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Only backend/service can insert payments (via service_role key)
-- Frontend should call Supabase Edge Functions which use service_role
CREATE POLICY "Service role can insert payments"
  ON payments FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only backend/service can update payments
CREATE POLICY "Service role can update payments"
  ON payments FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Helper Views ────────────────────────────────────────────────

-- View: Recent payments with order details
CREATE OR REPLACE VIEW recent_payments AS
SELECT
  p.id,
  p.order_id,
  o.tracking_code,
  p.amount,
  p.method,
  p.status,
  p.transaction_id,
  p.phone_number,
  p.created_at,
  p.completed_at,
  pr.name as customer_name,
  pr.email as customer_email
FROM payments p
JOIN orders o ON p.order_id = o.id
LEFT JOIN profiles pr ON o.customer_id = pr.id
ORDER BY p.created_at DESC;

-- View: Payment statistics
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
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as success_rate_percentage
FROM payments
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- ── Utility Functions ───────────────────────────────────────────

-- Function: Get payment by checkout request ID
CREATE OR REPLACE FUNCTION get_payment_by_checkout_request_id(checkout_id TEXT)
RETURNS TABLE (
  id UUID,
  order_id UUID,
  amount NUMERIC,
  status payment_status,
  transaction_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.order_id, p.amount, p.status, p.transaction_id
  FROM payments p
  WHERE p.checkout_request_id = checkout_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Verify payment completion
CREATE OR REPLACE FUNCTION verify_payment_for_order(p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  payment_completed BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM payments
    WHERE order_id = p_order_id
      AND status = 'completed'
  ) INTO payment_completed;

  RETURN payment_completed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Sample Data for Testing (Optional - Remove in production) ──
-- Uncomment to add test data
/*
INSERT INTO payments (order_id, amount, method, status, phone_number, transaction_id)
SELECT
  id,
  total,
  'mpesa'::payment_method,
  'completed'::payment_status,
  '254712345678',
  'QGR' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 7)
FROM orders
LIMIT 5;
*/

-- ============================================================
-- Migration Complete!
-- ============================================================

-- Verify tables created
SELECT
  'payments' as table_name,
  COUNT(*) as row_count
FROM payments
UNION ALL
SELECT
  'orders',
  COUNT(*)
FROM orders;

-- Show payment statistics
SELECT * FROM payment_stats;

COMMENT ON TABLE payments IS 'Stores all payment transactions for orders, including M-Pesa STK Push and QR code payments';
COMMENT ON COLUMN payments.checkout_request_id IS 'Unique identifier from M-Pesa STK Push request, used to track payment status';
COMMENT ON COLUMN payments.transaction_id IS 'M-Pesa receipt number received after successful payment (e.g., QGR7I8K9LM)';
COMMENT ON COLUMN payments.merchant_request_id IS 'Merchant request ID from payment provider';
COMMENT ON VIEW recent_payments IS 'View of recent payments with order and customer details for reporting';
COMMENT ON VIEW payment_stats IS 'Aggregated payment statistics for the last 30 days';
