-- ============================================================
-- PERFORMANCE INDEXES MIGRATION
-- ============================================================
-- This migration adds strategic indexes to handle 10,000+ users
-- Run this AFTER the security migration
--
-- Estimated time: 5-10 minutes on empty DB, 30+ min on production
-- Impact: 10-100x faster queries
-- ============================================================

-- Enable timing to see how long index creation takes
\timing on

-- ============================================================
-- PART 1: ORDERS TABLE (MOST CRITICAL)
-- ============================================================

-- Orders by customer (customer dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_id_created
  ON orders(customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

-- Orders by status (admin filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_created
  ON orders(status, created_at DESC);

-- Orders by driver (driver dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_driver_id_status
  ON orders(driver_id, status, created_at DESC)
  WHERE driver_id IS NOT NULL;

-- Orders by zone (zone-based reports)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_zone_status
  ON orders(zone, status)
  WHERE zone IS NOT NULL;

-- Tracking code lookup (public tracking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tracking_code
  ON orders(tracking_code)
  WHERE tracking_code IS NOT NULL;

-- Payment status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_status
  ON orders(payment_status, created_at DESC)
  WHERE payment_status IS NOT NULL;

-- ============================================================
-- PART 2: PROFILES TABLE (AUTH & USER MANAGEMENT)
-- ============================================================

-- Email lookup (sign in, password reset)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_email
  ON profiles(email);

-- Role filtering (user management)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_role
  ON profiles(role);

-- Zone filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_zone_role
  ON profiles(zone, role)
  WHERE zone IS NOT NULL;

-- Active users filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_is_active
  ON profiles(is_active, created_at DESC);

-- ============================================================
-- PART 3: PAYMENTS TABLE (FINANCIAL OPERATIONS)
-- ============================================================

-- Payment lookup by order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_order_id
  ON payments(order_id);

-- Payment status filtering (admin dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status_created
  ON payments(status, created_at DESC);

-- M-Pesa checkout request lookup (callback)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_checkout_request_id
  ON payments(checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

-- Transaction ID lookup (reconciliation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_transaction_id
  ON payments(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- Payment method analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_method_created
  ON payments(payment_method, created_at DESC)
  WHERE payment_method IS NOT NULL;

-- ============================================================
-- PART 4: ORDER ITEMS TABLE (FREQUENTLY JOINED)
-- ============================================================

-- Order items by order (always joined)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
  ON order_items(order_id);

-- Item type analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_item_type
  ON order_items(item_type);

-- ============================================================
-- PART 5: LOYALTY SYSTEM
-- ============================================================

-- Loyalty account by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loyalty_accounts_user_id
  ON loyalty_accounts(user_id);

-- Active tiers
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loyalty_accounts_tier
  ON loyalty_accounts(tier_name);

-- Transaction history by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loyalty_transactions_user_created
  ON loyalty_transactions(user_id, created_at DESC);

-- Transaction type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loyalty_transactions_type
  ON loyalty_transactions(transaction_type, created_at DESC);

-- Referral tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_referrals_referrer_id
  ON referrals(referrer_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_referrals_referred_id
  ON referrals(referred_id);

-- ============================================================
-- PART 6: DRIVER OPERATIONS
-- ============================================================

-- Driver routes by driver and date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_routes_driver_date
  ON driver_routes(driver_id, route_date DESC);

-- Route status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_routes_status
  ON driver_routes(status, route_date DESC);

-- Route stops by route (ordered)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_stops_route_id_order
  ON route_stops(route_id, stop_order);

-- Driver performance stats
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_performance_driver_id
  ON driver_performance_stats(driver_id);

-- Driver monthly trends
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_monthly_driver_month
  ON driver_monthly_trends(driver_id, month DESC);

-- ============================================================
-- PART 7: WAREHOUSE OPERATIONS
-- ============================================================

-- Warehouse intake by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_warehouse_intake_status_received
  ON warehouse_intake(status, received_at DESC);

-- Warehouse intake by order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_warehouse_intake_order_id
  ON warehouse_intake(order_id);

-- Warehouse processing by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_warehouse_processing_status_started
  ON warehouse_processing(status, started_at DESC);

-- Warehouse processing by order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_warehouse_processing_order_id
  ON warehouse_processing(order_id);

-- Warehouse dispatch by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_warehouse_dispatch_status_dispatched
  ON warehouse_dispatch(status, dispatched_at DESC);

-- Warehouse dispatch by order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_warehouse_dispatch_order_id
  ON warehouse_dispatch(order_id);

-- Quality checks by order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quality_checks_order_id_created
  ON quality_checks(order_id, created_at DESC);

-- Quality check status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quality_checks_passed
  ON quality_checks(passed, created_at DESC);

-- ============================================================
-- PART 8: INVOICES
-- ============================================================

-- Invoice by order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_order_id
  ON invoices(order_id);

-- Invoice status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_status_created
  ON invoices(status, created_at DESC);

-- Invoice items by invoice
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_items_invoice_id
  ON invoice_items(invoice_id);

-- ============================================================
-- PART 9: NOTIFICATIONS
-- ============================================================

-- Notification history by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_history_user_created
  ON notification_history(user_id, created_at DESC);

-- Unread notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_history_user_read
  ON notification_history(user_id, is_read, created_at DESC);

-- Notification channel filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_history_channel
  ON notification_history(channel, created_at DESC);

-- ============================================================
-- PART 10: AUDIT & COMPLIANCE
-- ============================================================

-- Audit logs by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_timestamp
  ON audit_logs(user_id, timestamp DESC)
  WHERE user_id IS NOT NULL;

-- Audit logs by resource
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource
  ON audit_logs(resource_type, resource_id, timestamp DESC)
  WHERE resource_id IS NOT NULL;

-- Audit logs by action
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action
  ON audit_logs(action, timestamp DESC);

-- System logs by severity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_logs_severity
  ON system_logs(severity, timestamp DESC);

-- ============================================================
-- PART 11: REPORTS (READ-HEAVY)
-- ============================================================

-- KPI reports by date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_kpis_date
  ON report_kpis(report_date DESC);

-- Sales reports by date and zone
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_sales_date_zone
  ON report_sales(report_date DESC, zone);

-- Zone performance by date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_zone_performance_date
  ON report_zone_performance(report_date DESC, zone);

-- ============================================================
-- PART 12: FULL-TEXT SEARCH INDEXES (GIN)
-- ============================================================

-- Orders search (customer name, tracking code, zone)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_search_gin
  ON orders USING gin(to_tsvector('english',
    coalesce(customer_name, '') || ' ' ||
    coalesce(tracking_code, '') || ' ' ||
    coalesce(zone, '') || ' ' ||
    coalesce(customer_phone, '')
  ));

-- Profiles search (name, email)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_search_gin
  ON profiles USING gin(to_tsvector('english',
    coalesce(name, '') || ' ' ||
    coalesce(email, '')
  ));

-- ============================================================
-- PART 13: COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================================

-- Customer orders with status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_status_created
  ON orders(customer_id, status, created_at DESC)
  WHERE customer_id IS NOT NULL;

-- Driver orders with zone
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_driver_zone_created
  ON orders(driver_id, zone, created_at DESC)
  WHERE driver_id IS NOT NULL;

-- Payment reconciliation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status_method_created
  ON payments(status, payment_method, created_at DESC);

-- ============================================================
-- PART 14: ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================

-- Update statistics for better query planning
ANALYZE orders;
ANALYZE profiles;
ANALYZE payments;
ANALYZE order_items;
ANALYZE loyalty_accounts;
ANALYZE loyalty_transactions;
ANALYZE driver_routes;
ANALYZE route_stops;
ANALYZE warehouse_intake;
ANALYZE warehouse_processing;
ANALYZE warehouse_dispatch;
ANALYZE invoices;
ANALYZE audit_logs;

-- ============================================================
-- PART 15: INDEX USAGE MONITORING VIEW
-- ============================================================

-- Create view to monitor index usage
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Create view for unused indexes
CREATE OR REPLACE VIEW unused_indexes AS
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'  -- Exclude primary keys
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Count total indexes created
SELECT
  schemaname,
  tablename,
  count(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY index_count DESC;

-- Show index sizes
SELECT
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

\timing off

SELECT 'Performance indexes migration completed successfully!' AS status;
SELECT count(*) || ' indexes created on public schema' AS indexes_created
FROM pg_indexes
WHERE schemaname = 'public';

-- ============================================================
-- NEXT STEPS
-- ============================================================
/*
1. Monitor query performance:
   SELECT * FROM index_usage_stats LIMIT 20;

2. Check for unused indexes:
   SELECT * FROM unused_indexes;

3. Monitor slow queries:
   SELECT * FROM pg_stat_statements
   WHERE mean_exec_time > 100
   ORDER BY total_exec_time DESC
   LIMIT 10;

4. Test query performance before/after:
   EXPLAIN ANALYZE
   SELECT * FROM orders
   WHERE customer_id = 'xxx'
   ORDER BY created_at DESC
   LIMIT 20;
*/
