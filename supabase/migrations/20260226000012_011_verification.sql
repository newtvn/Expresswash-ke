-- ============================================================
-- VERIFICATION SCRIPT: Day 1 + Day 2 combined
-- Run this after all migrations 000-010 are applied.
-- All assertions must pass.
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  required_tables TEXT[] := ARRAY[
    'zones', 'order_status_history', 'reviews', 'expenses',
    'promotions', 'promotion_usage', 'payment_reminders',
    'notification_preferences'
  ];
  required_columns TEXT[][] := ARRAY[
    ARRAY['profiles', 'birthday'],
    ARRAY['profiles', 'preferred_language'],
    ARRAY['profiles', 'archived_at'],
    ARRAY['orders', 'sla_deadline'],
    ARRAY['orders', 'priority'],
    ARRAY['notification_history', 'retry_count']
  ];
  required_triggers TEXT[] := ARRAY[
    'validate_order_status',
    'log_status_change',
    'queue_notification_on_status',
    'on_order_delivery_stats',
    'on_profile_created_prefs'
  ];
  col TEXT[];
  trg TEXT;
  trigger_count INTEGER;
BEGIN
  -- ========== DAY 1 CHECKS ==========

  -- Check status constraint allows 1-14
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'check_order_status'
  ), 'MISSING: check_order_status constraint';
  RAISE NOTICE '✓ Order status constraint exists (1-14)';

  -- Check all new tables exist
  FOREACH tbl IN ARRAY required_tables LOOP
    ASSERT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ), 'MISSING TABLE: ' || tbl;
  END LOOP;
  RAISE NOTICE '✓ All 8 new tables exist';

  -- Check new columns exist
  FOREACH col SLICE 1 IN ARRAY required_columns LOOP
    ASSERT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = col[1] AND column_name = col[2]
    ), 'MISSING COLUMN: ' || col[1] || '.' || col[2];
  END LOOP;
  RAISE NOTICE '✓ All new columns exist';

  -- Check RLS enabled on all new tables
  FOREACH tbl IN ARRAY required_tables LOOP
    ASSERT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE tablename = tbl AND rowsecurity = true
    ), 'RLS NOT ENABLED: ' || tbl;
  END LOOP;
  RAISE NOTICE '✓ RLS enabled on all new tables';

  -- Check zones seeded
  ASSERT (SELECT count(*) FROM zones) >= 3, 'Zones not seeded';
  RAISE NOTICE '✓ Zones seeded (3 records)';

  -- Check critical indexes
  ASSERT (SELECT count(*) FROM pg_indexes WHERE tablename = 'orders') >= 7,
    'Orders table has fewer than 7 indexes';
  RAISE NOTICE '✓ Orders indexes verified (>= 7)';

  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'notification_history' AND indexname = 'idx_notifications_pending'
  ), 'Missing idx_notifications_pending index';
  RAISE NOTICE '✓ Notification pending queue index verified';

  -- ========== DAY 2 CHECKS ==========

  -- Check all triggers exist
  FOREACH trg IN ARRAY required_triggers LOOP
    ASSERT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = trg
    ), 'MISSING TRIGGER: ' || trg;
  END LOOP;
  RAISE NOTICE '✓ All 5 core triggers exist';

  -- Check audit triggers on new tables
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'audit_reviews'
  ), 'MISSING: audit_reviews trigger';
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'audit_expenses'
  ), 'MISSING: audit_expenses trigger';
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'audit_promotions'
  ), 'MISSING: audit_promotions trigger';
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'audit_zones'
  ), 'MISSING: audit_zones trigger';
  RAISE NOTICE '✓ Audit triggers on new tables verified';

  -- Count total triggers on orders table (should be >= 4)
  SELECT count(*) INTO trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  WHERE c.relname = 'orders' AND NOT t.tgisinternal;
  ASSERT trigger_count >= 4, 'Orders table has fewer than 4 triggers: ' || trigger_count;
  RAISE NOTICE '✓ Orders table has % triggers', trigger_count;

  -- Check email templates seeded
  ASSERT EXISTS (
    SELECT 1 FROM notification_templates
    WHERE name = 'Order Confirmation' AND channel = 'email'
  ), 'Missing email template: Order Confirmation';
  RAISE NOTICE '✓ Email notification templates verified';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DAY 1+2 VERIFICATION: ALL CHECKS PASSED';
  RAISE NOTICE '========================================';
END $$;
