-- ============================================================
-- Migration: Fix order status CHECK constraint
-- The security migration (supabase-migration-security-fixes.sql:642)
-- added CHECK (status >= 0 AND status <= 6) but the application
-- uses a 14-stage pipeline (1=PENDING through 14=REFUNDED).
-- This blocks statuses 7-14 from being stored.
-- ============================================================

ALTER TABLE orders DROP CONSTRAINT IF EXISTS check_order_status;

ALTER TABLE orders ADD CONSTRAINT check_order_status
  CHECK (status >= 1 AND status <= 14);

-- Verify the constraint exists and allows the full range
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'check_order_status'
  ), 'check_order_status constraint missing after migration';

  RAISE NOTICE '✓ Order status constraint updated: now allows 1-14';
END $$;
