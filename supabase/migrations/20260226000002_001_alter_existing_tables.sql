-- ============================================================
-- Migration: Add missing columns to existing tables
-- Adds production-required columns per PROD_PLAN_SPEC Section 3.2
-- ============================================================

-- ============================================================
-- PROFILES: Add missing columns for CRM and compliance
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'birthday'
  ), 'profiles.birthday column missing';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'preferred_language'
  ), 'profiles.preferred_language column missing';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'archived_at'
  ), 'profiles.archived_at column missing';

  RAISE NOTICE '✓ profiles columns verified (birthday, preferred_language, archived_at)';
END $$;

-- ============================================================
-- ORDERS: Add SLA and priority tracking
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- Add CHECK constraint for priority values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'orders_priority_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_priority_check
      CHECK (priority IN ('normal', 'high', 'urgent'));
  END IF;
END $$;

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'sla_deadline'
  ), 'orders.sla_deadline column missing';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'priority'
  ), 'orders.priority column missing';

  RAISE NOTICE '✓ orders columns verified (sla_deadline, priority)';
END $$;

-- ============================================================
-- NOTIFICATION_HISTORY: Add retry logic column
--
-- NOTE: sent_at ALREADY EXISTS (TIMESTAMPTZ NOT NULL DEFAULT now())
-- NOTE: failure_reason ALREADY EXISTS (TEXT)
-- Only retry_count is genuinely missing.
-- ============================================================
ALTER TABLE notification_history ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_history' AND column_name = 'retry_count'
  ), 'notification_history.retry_count column missing';

  RAISE NOTICE '✓ notification_history.retry_count verified';
END $$;
