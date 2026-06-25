-- ============================================================
-- Migration: Create/verify all critical production indexes
--
-- Column names verified against actual schema:
--   orders.driver_id (not assigned_driver_id)
--   notification_history.recipient_id (not user_id)
--   notification_history status = 'pending' (not 'queued')
--   invoices.status (not invoice_status)
--   invoices.due_at (not due_date)
--   audit_logs.timestamp (not created_at)
--   profiles.phone (not phone_number)
-- ============================================================

-- ============================================================
-- ORDERS (high-traffic table)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_driver
  ON orders(driver_id) WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_sla
  ON orders(sla_deadline) WHERE sla_deadline IS NOT NULL AND status NOT IN (12, 13, 14);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due
  ON invoices(due_at) WHERE status IN ('sent', 'partially_paid', 'overdue');

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_checkout
  ON payments(checkout_request_id) WHERE checkout_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(created_at DESC);

-- ============================================================
-- NOTIFICATION HISTORY
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notification_history(recipient_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_pending
  ON notification_history(status, sent_at ASC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notifications_failed
  ON notification_history(status) WHERE status = 'failed';

-- ============================================================
-- AUDIT LOGS (high-volume table)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(timestamp DESC);

-- ============================================================
-- PROFILES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM pg_indexes WHERE tablename = 'orders') >= 7,
    'Orders table has fewer than 7 indexes';
  RAISE NOTICE '✓ Orders indexes verified (>= 7)';

  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'notification_history' AND indexname = 'idx_notifications_pending'
  ), 'Missing idx_notifications_pending index';
  RAISE NOTICE '✓ Notification pending queue index verified';

  ASSERT (SELECT count(*) FROM pg_indexes WHERE tablename = 'audit_logs') >= 3,
    'Audit logs has fewer than 3 indexes';
  RAISE NOTICE '✓ Audit logs indexes verified (>= 3)';
END $$;
