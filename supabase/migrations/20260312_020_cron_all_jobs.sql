-- ============================================================
-- ALL CRON JOBS (pg_cron + pg_net required)
--
-- PREREQUISITES (Supabase Dashboard → Database → Extensions):
--   1. Enable pg_cron
--   2. Enable pg_net
--   3. Configure vault secrets OR database settings:
--      SELECT vault.create_secret('https://<ref>.supabase.co', 'supabase_url');
--      SELECT vault.create_secret('<service-role-key>', 'service_role_key');
--
-- This file registers 5 cron jobs. Run in Supabase SQL Editor.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- JOB 1: Process notification queue (every minute)
-- Calls send-notification Edge Function via pg_net
-- ────────────────────────────────────────────────────────────

SELECT cron.unschedule('process-notification-queue')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-notification-queue');

SELECT cron.schedule(
  'process-notification-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
           || '/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' ||
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ────────────────────────────────────────────────────────────
-- JOB 2: Payment reminders (daily 6:00 UTC = 9:00 EAT)
-- 3-stage escalation: 4 days before, 1 day before, 1 day overdue
-- Idempotent via payment_reminders table
-- ────────────────────────────────────────────────────────────

SELECT cron.unschedule('payment-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'payment-reminders');

SELECT cron.schedule(
  'payment-reminders',
  '0 6 * * *',
  $$

  -- REMINDER 1: 4 days before due
  WITH eligible_r1 AS (
    SELECT i.id AS invoice_id, i.invoice_number, i.total,
           i.customer_id, p.phone, p.name, p.email
    FROM invoices i
    JOIN profiles p ON p.id = i.customer_id
    LEFT JOIN payment_reminders pr
      ON pr.invoice_id = i.id AND pr.reminder_number = 1
    WHERE i.status IN ('sent', 'partially_paid')
      AND i.due_at::date - CURRENT_DATE = 4
      AND pr.id IS NULL
      AND p.phone IS NOT NULL
      AND p.is_active = true
  ),
  sms_inserts_r1 AS (
    INSERT INTO notification_history (
      template_name, channel, recipient_id, recipient_name, recipient_contact, body, status
    )
    SELECT
      'payment_reminder_1',
      'sms',
      customer_id::text,
      COALESCE(name, 'Customer'),
      phone,
      'Hi ' || COALESCE(name, 'Customer') || ', your invoice '
        || invoice_number || ' for KES '
        || to_char(total, 'FM999,999,999')
        || ' is due in 4 days. Pay via M-Pesa to avoid delays. Thank you! - ExpressWash',
      'pending'
    FROM eligible_r1
    RETURNING recipient_contact
  )
  INSERT INTO payment_reminders (invoice_id, reminder_number, channel)
  SELECT invoice_id, 1, 'sms' FROM eligible_r1;

  -- REMINDER 2: 1 day before due
  WITH eligible_r2 AS (
    SELECT i.id AS invoice_id, i.invoice_number, i.total,
           i.customer_id, p.phone, p.name
    FROM invoices i
    JOIN profiles p ON p.id = i.customer_id
    LEFT JOIN payment_reminders pr
      ON pr.invoice_id = i.id AND pr.reminder_number = 2
    WHERE i.status IN ('sent', 'partially_paid')
      AND i.due_at::date - CURRENT_DATE = 1
      AND pr.id IS NULL
      AND p.phone IS NOT NULL
      AND p.is_active = true
  ),
  sms_inserts_r2 AS (
    INSERT INTO notification_history (
      template_name, channel, recipient_id, recipient_name, recipient_contact, body, status
    )
    SELECT
      'payment_reminder_2',
      'sms',
      customer_id::text,
      COALESCE(name, 'Customer'),
      phone,
      'Reminder: Invoice ' || invoice_number || ' for KES '
        || to_char(total, 'FM999,999,999')
        || ' is due TOMORROW. Please pay via M-Pesa to avoid late fees. - ExpressWash',
      'pending'
    FROM eligible_r2
    RETURNING recipient_contact
  )
  INSERT INTO payment_reminders (invoice_id, reminder_number, channel)
  SELECT invoice_id, 2, 'sms' FROM eligible_r2;

  -- REMINDER 3: 1 day overdue
  WITH eligible_r3 AS (
    SELECT i.id AS invoice_id, i.invoice_number, i.total,
           i.customer_id, p.phone, p.name
    FROM invoices i
    JOIN profiles p ON p.id = i.customer_id
    LEFT JOIN payment_reminders pr
      ON pr.invoice_id = i.id AND pr.reminder_number = 3
    WHERE i.status IN ('sent', 'partially_paid', 'overdue')
      AND CURRENT_DATE - i.due_at::date = 1
      AND pr.id IS NULL
      AND p.phone IS NOT NULL
      AND p.is_active = true
  ),
  sms_inserts_r3 AS (
    INSERT INTO notification_history (
      template_name, channel, recipient_id, recipient_name, recipient_contact, body, status
    )
    SELECT
      'payment_reminder_3',
      'sms',
      customer_id::text,
      COALESCE(name, 'Customer'),
      phone,
      'OVERDUE: Invoice ' || invoice_number || ' for KES '
        || to_char(total, 'FM999,999,999')
        || ' was due yesterday. Please pay immediately to avoid service interruption. - ExpressWash',
      'pending'
    FROM eligible_r3
    RETURNING recipient_contact
  )
  INSERT INTO payment_reminders (invoice_id, reminder_number, channel)
  SELECT invoice_id, 3, 'sms' FROM eligible_r3;

  -- Auto-mark overdue invoices
  UPDATE invoices
  SET status = 'overdue'
  WHERE status IN ('sent', 'partially_paid')
    AND due_at::date < CURRENT_DATE;

  $$
);

-- ────────────────────────────────────────────────────────────
-- JOB 3: SLA monitoring (every 2 hours)
-- Alerts admin on approaching/breached SLA deadlines
-- ────────────────────────────────────────────────────────────

SELECT cron.unschedule('sla-monitoring')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sla-monitoring');

SELECT cron.schedule(
  'sla-monitoring',
  '0 */2 * * *',
  $$

  WITH approaching AS (
    SELECT o.id, o.tracking_code, o.status, o.sla_deadline,
           o.customer_id, p.name AS customer_name
    FROM orders o
    LEFT JOIN profiles p ON p.id = o.customer_id
    WHERE o.sla_deadline IS NOT NULL
      AND o.sla_deadline BETWEEN NOW() AND NOW() + INTERVAL '4 hours'
      AND o.status NOT IN (12, 13, 14)
    ORDER BY o.sla_deadline ASC
    LIMIT 20
  ),
  breached AS (
    SELECT o.id, o.tracking_code, o.status, o.sla_deadline,
           o.customer_id, p.name AS customer_name
    FROM orders o
    LEFT JOIN profiles p ON p.id = o.customer_id
    WHERE o.sla_deadline IS NOT NULL
      AND o.sla_deadline < NOW()
      AND o.status NOT IN (12, 13, 14)
    ORDER BY o.sla_deadline ASC
    LIMIT 20
  )
  INSERT INTO notification_history (
    template_name, channel, recipient_id, recipient_name, recipient_contact, body, status
  )
  SELECT
    'sla_alert',
    'sms',
    admin_phones.id::text,
    COALESCE(admin_phones.name, 'Admin'),
    admin_phones.phone,
    CASE
      WHEN (SELECT count(*) FROM approaching) > 0 AND (SELECT count(*) FROM breached) > 0 THEN
        'SLA ALERT: ' || (SELECT count(*) FROM breached) || ' BREACHED, '
        || (SELECT count(*) FROM approaching) || ' approaching. '
        || 'Nearest: ' || COALESCE(
          (SELECT tracking_code FROM approaching ORDER BY sla_deadline LIMIT 1),
          (SELECT tracking_code FROM breached ORDER BY sla_deadline LIMIT 1)
        )
      WHEN (SELECT count(*) FROM breached) > 0 THEN
        'SLA BREACHED: ' || (SELECT count(*) FROM breached)
        || ' orders past deadline! First: '
        || (SELECT tracking_code FROM breached ORDER BY sla_deadline LIMIT 1)
      WHEN (SELECT count(*) FROM approaching) > 0 THEN
        'SLA WARNING: ' || (SELECT count(*) FROM approaching)
        || ' orders approaching deadline in next 4h. First: '
        || (SELECT tracking_code FROM approaching ORDER BY sla_deadline LIMIT 1)
      ELSE NULL
    END,
    'pending'
  FROM (
    SELECT id, name, phone FROM profiles
    WHERE role IN ('admin', 'super_admin') AND is_active = true AND phone IS NOT NULL
  ) admin_phones
  WHERE (SELECT count(*) FROM approaching) > 0
     OR (SELECT count(*) FROM breached) > 0;

  $$
);

-- ────────────────────────────────────────────────────────────
-- JOB 4: Warehouse aging alerts (daily 7:00 UTC = 10:00 EAT)
-- Flags items in warehouse > 7 days without dispatch
-- ────────────────────────────────────────────────────────────

SELECT cron.unschedule('warehouse-aging')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'warehouse-aging');

SELECT cron.schedule(
  'warehouse-aging',
  '0 7 * * *',
  $$

  WITH aged_items AS (
    SELECT wi.order_id, wi.created_at AS intake_date,
           EXTRACT(DAY FROM NOW() - wi.created_at)::INTEGER AS days_in_warehouse,
           o.tracking_code, o.status
    FROM warehouse_intake wi
    -- warehouse_intake.order_id is TEXT while orders.id is UUID (schema constraint),
    -- hence the ::text cast on both sides for the JOIN condition
    JOIN orders o ON o.id::text = wi.order_id::text
    WHERE wi.created_at < NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM warehouse_dispatch wd
        WHERE wd.order_id = wi.order_id
      )
      AND o.status NOT IN (12, 13, 14)
  )
  INSERT INTO notification_history (
    template_name, channel, recipient_id, recipient_name, recipient_contact, body, status
  )
  SELECT
    'warehouse_aging',
    'sms',
    admin_phones.id::text,
    COALESCE(admin_phones.name, 'Admin'),
    admin_phones.phone,
    'WAREHOUSE AGING: ' || (SELECT count(*) FROM aged_items)
      || ' items have been in warehouse > 7 days. '
      || 'Oldest: ' || COALESCE(
        (SELECT tracking_code || ' (' || days_in_warehouse || ' days)' FROM aged_items ORDER BY intake_date ASC LIMIT 1),
        'unknown'
      )
      || '. Please review intake queue.',
    'pending'
  FROM (
    SELECT id, name, phone FROM profiles
    WHERE role IN ('admin', 'super_admin') AND is_active = true AND phone IS NOT NULL
  ) admin_phones
  WHERE (SELECT count(*) FROM aged_items) > 0;

  $$
);

-- ────────────────────────────────────────────────────────────
-- JOB 5: Birthday discounts (daily 3:00 UTC = 6:00 EAT)
-- Creates promo codes for customers with birthdays in 7 days
-- ────────────────────────────────────────────────────────────

SELECT cron.unschedule('birthday-discounts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'birthday-discounts');

SELECT cron.schedule(
  'birthday-discounts',
  '0 3 * * *',
  $$

  -- Guard uses the promo code itself (deterministic per customer+year)
  -- to detect duplicates, avoiding name-collision and created_by mismatch issues.
  WITH birthday_customers AS (
    SELECT p.id, p.name, p.phone, p.email,
           'BDAY-' || UPPER(SUBSTR(MD5(p.id::text || CURRENT_DATE::text), 1, 6)) AS expected_code
    FROM profiles p
    WHERE p.birthday IS NOT NULL
      AND p.role = 'customer'
      AND p.is_active = true
      AND EXTRACT(MONTH FROM p.birthday) = EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL '7 days')
      AND EXTRACT(DAY FROM p.birthday) = EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '7 days')
      AND NOT EXISTS (
        SELECT 1 FROM promotions promo
        WHERE promo.promotion_type = 'birthday'
          AND promo.code = 'BDAY-' || UPPER(SUBSTR(MD5(p.id::text || CURRENT_DATE::text), 1, 6))
      )
  ),
  new_promos AS (
    INSERT INTO promotions (
      name, code, discount_type, discount_value,
      valid_from, valid_until, is_active,
      promotion_type, usage_limit, usage_per_customer,
      created_by
    )
    SELECT
      'Birthday - ' || bc.name || ' (' || bc.id::text || ')',
      bc.expected_code,
      'percentage',
      20.00,
      NOW(),
      NOW() + INTERVAL '7 days',
      true,
      'birthday',
      1,
      1,
      (SELECT id FROM profiles WHERE role = 'super_admin' LIMIT 1)
    FROM birthday_customers bc
    RETURNING id, name, code
  )
  INSERT INTO notification_history (
    template_name, channel, recipient_id, recipient_name, recipient_contact, body, status
  )
  SELECT
    'birthday_greeting',
    'sms',
    bc.id::text,
    COALESCE(bc.name, 'Customer'),
    bc.phone,
    'Happy Birthday ' || COALESCE(bc.name, '') || '! '
      || 'ExpressWash wishes you a wonderful day. '
      || 'Enjoy 20% off your next order with code: '
      || np.code || ' (valid 7 days).',
    'pending'
  FROM birthday_customers bc
  JOIN new_promos np ON np.code = bc.expected_code
  WHERE bc.phone IS NOT NULL;

  $$
);

-- ────────────────────────────────────────────────────────────
-- Verify all jobs registered
-- ────────────────────────────────────────────────────────────
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
