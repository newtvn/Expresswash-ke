-- Performance Optimization: Add indexes for frequently queried columns
-- Created: 2026-02-17
-- Purpose: Improve query performance for orders and payments tables

-- Add index on orders.status (frequently filtered in dashboards and reports)
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Add index on orders.zone (zone-based filtering)
CREATE INDEX IF NOT EXISTS idx_orders_zone ON orders(zone);

-- Add index on orders.created_at (date range queries in reports)
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Add index on payments.status (revenue calculations and filtering)
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at);

-- Add index on orders.driver_id for driver-specific queries
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);

-- Add index on orders.customer_id for customer order history
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Comments for documentation
COMMENT ON INDEX idx_orders_status IS 'Improves performance for status-based filtering in dashboards';
COMMENT ON INDEX idx_orders_zone IS 'Optimizes zone-based order queries';
COMMENT ON INDEX idx_orders_created_at IS 'Speeds up date range queries in reports';
COMMENT ON INDEX idx_payments_status IS 'Enhances payment status filtering and revenue calculations';
COMMENT ON INDEX idx_orders_status_created_at IS 'Composite index for status + date range queries';
COMMENT ON INDEX idx_orders_driver_id IS 'Optimizes driver-specific order queries';
COMMENT ON INDEX idx_orders_customer_id IS 'Speeds up customer order history lookups';
