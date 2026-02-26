# EXPRESSWASH — WEEK 3 EXECUTION PLAN

## Scheduled Automation, Loyalty Fix, Zone Management, Promotions

**Goal:** By end of Week 3, the system runs unattended — payment reminders go out on schedule, SLA breaches alert admins, stale warehouse items get flagged, and birthday discounts generate automatically. Admins can manage delivery zones and promotion codes through the UI. Customers can apply promo codes at checkout. Loyalty points earn proportional to spend.

**Outcome test:** An invoice due in 4 days triggers a reminder SMS at 9 AM without anyone touching the system. An admin creates a "RAINY20" promotion code for 20% off, a customer applies it during checkout, and the discount is validated server-side and reflected on the invoice. A KES 10,000 order earns 100 loyalty points (not flat 50).

---

## PREREQUISITE: VERIFY WEEK 2

```sql
-- Quick Week 2 health check (run on staging)
DO $$
BEGIN
  -- PDF Edge Function deployed
  -- (verify manually: call generate-pdf with a test invoice ID)

  -- Payment notification trigger exists
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'notify_on_payment'
  ), 'notify_on_payment trigger missing';

  -- Pricing function exists
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'calculate_order_pricing'
  ), 'calculate_order_pricing function missing';

  -- Event tables exist (from WK2/3 commit)
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_status_events'
  ), 'payment_status_events missing';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_status_events'
  ), 'invoice_status_events missing';

  RAISE NOTICE '✓ Week 2 foundation verified. Proceed with Week 3.';
END $$;
```

Also verify:
- [ ] Invoice PDF downloads work from customer portal
- [ ] Receipt PDF downloads work
- [ ] Reviews submit and moderate correctly
- [ ] Expenses create and approve correctly
- [ ] Server-side pricing returns correct amounts via `calculate_order_pricing()`

---

## DEPENDENCY MAP

```
Day 1: pg_cron activation + all 5 scheduled jobs
  │
  ├── Day 2: Notification templates for cron jobs + loyalty points fix (independent)
  │
  ├── Day 3: Admin zone management UI + frontend zone-aware delivery
  │
  ├── Day 4: Promotions admin CRUD + checkout promo code validation
  │
  └── Day 5: End-to-end automation testing + comprehensive verification
```

Days 1-2 are tightly coupled (cron jobs need templates to send). Days 3-4 are independent UI wiring. Day 5 verifies everything.

---

## DAY 1 (Monday): pg_cron ACTIVATION + ALL SCHEDULED JOBS

### What happens today
Enable pg_cron and pg_net extensions on Supabase. Deploy all 5 scheduled jobs. By end of day, the jobs are registered and running on schedule.

**Important:** All cron times are UTC. Kenya is UTC+3 (EAT). So 9:00 AM EAT = 6:00 AM UTC.

---

### Task 1.1: Enable pg_cron and pg_net

**In Supabase Dashboard:**
1. Go to Database → Extensions
2. Search for `pg_cron` → Toggle ON
3. Search for `pg_net` → Toggle ON
4. Wait ~30 seconds for both to activate

**Verify:**
```sql
-- Both should return rows
SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');

-- pg_cron schema should exist
SELECT * FROM cron.job; -- Empty table is fine, just checking it exists
```

---

### Task 1.2: Set application-level config for Edge Function URL

The cron jobs need to call the `send-notification` Edge Function. Store the URL and service role key so cron SQL can reference them.

```sql
-- Option A: Use Supabase Vault (preferred — secrets are encrypted)
-- In Supabase Dashboard → SQL Editor:
SELECT vault.create_secret(
  'https://<your-project-ref>.supabase.co',
  'supabase_url'
);
SELECT vault.create_secret(
  '<your-service-role-key>',
  'service_role_key'
);

-- Verify
SELECT name FROM vault.decrypted_secrets WHERE name IN ('supabase_url', 'service_role_key');
```

If Vault isn't available (some Supabase plans), use `ALTER DATABASE` settings:

```sql
-- Option B: Database-level settings (less secure, but works)
ALTER DATABASE postgres SET app.supabase_url = 'https://<your-project-ref>.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = '<your-service-role-key>';

-- Verify
SELECT current_setting('app.supabase_url');
SELECT current_setting('app.service_role_key');
```

---

### Task 1.3: Deploy notification queue processor (every 1 minute)

This is the most critical job — it processes the `notification_history` queue by calling the `send-notification` Edge Function.

**File:** `supabase/migrations/20260312_020_cron_notification_processor.sql`

```sql
-- ============================================================
-- CRON JOB 1: Process notification queue every minute
-- Calls the send-notification Edge Function via pg_net
-- ============================================================

-- Unschedule if already exists (safe re-run)
SELECT cron.unschedule('process-notification-queue')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-notification-queue');

SELECT cron.schedule(
  'process-notification-queue',
  '* * * * *',  -- Every minute
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
```

**If using Option B (database settings) instead of Vault:**
```sql
SELECT cron.schedule(
  'process-notification-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Verify:**
```sql
-- Insert a test queued notification
INSERT INTO notification_history (user_id, channel, recipient, content, status)
VALUES (
  (SELECT id FROM profiles LIMIT 1),
  'sms',
  '+254XXXXXXXXX', -- Your test phone
  'ExpressWash pg_cron test: automated queue processing is working!',
  'queued'
);

-- Wait 60-90 seconds, then check
SELECT id, status, sent_at, error_message
FROM notification_history
ORDER BY created_at DESC LIMIT 1;
-- status should be 'sent'
```

✅ **If the SMS arrives without manual intervention, the queue processor is working.**

---

### Task 1.4: Deploy payment reminders (daily 9:00 AM EAT)

**File:** `supabase/migrations/20260312_021_cron_payment_reminders.sql`

```sql
-- ============================================================
-- CRON JOB 2: Payment reminders
-- Runs daily at 9:00 AM EAT (6:00 AM UTC)
--
-- Schedule:
--   Reminder 1: 4 days before due date
--   Reminder 2: 1 day before due date
--   Reminder 3: 1 day after due date (overdue)
--   Reminder 4+: Every 3 days after overdue
--
-- Guards:
--   - Only sends if no reminder of that number was already sent (idempotent)
--   - Only for invoices with status 'sent' or 'partially_paid'
--   - Only for customers with active phone numbers
--   - Records each reminder in payment_reminders table
-- ============================================================

SELECT cron.unschedule('payment-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'payment-reminders');

SELECT cron.schedule(
  'payment-reminders',
  '0 6 * * *',  -- 6:00 AM UTC = 9:00 AM EAT
  $$

  -- ---- REMINDER 1: 4 days before due ----
  WITH eligible_r1 AS (
    SELECT i.id AS invoice_id, i.invoice_number, i.total_amount,
           i.customer_id, p.phone_number, p.name, p.email
    FROM invoices i
    JOIN profiles p ON p.id = i.customer_id
    LEFT JOIN payment_reminders pr
      ON pr.invoice_id = i.id AND pr.reminder_number = 1
    WHERE i.invoice_status IN ('sent', 'partially_paid')
      AND i.due_date::date - CURRENT_DATE = 4
      AND pr.id IS NULL
      AND p.phone_number IS NOT NULL
      AND p.is_active = true
  ),
  sms_inserts_r1 AS (
    INSERT INTO notification_history (user_id, channel, recipient, content, status)
    SELECT
      customer_id,
      'sms',
      phone_number,
      'Hi ' || COALESCE(name, 'Customer') || ', your invoice '
        || invoice_number || ' for KES '
        || to_char(total_amount, 'FM999,999,999')
        || ' is due in 4 days. Pay via M-Pesa to avoid delays. Thank you! - ExpressWash',
      'queued'
    FROM eligible_r1
    RETURNING recipient
  )
  INSERT INTO payment_reminders (invoice_id, reminder_number, channel)
  SELECT invoice_id, 1, 'sms' FROM eligible_r1;

  -- ---- REMINDER 2: 1 day before due ----
  WITH eligible_r2 AS (
    SELECT i.id AS invoice_id, i.invoice_number, i.total_amount,
           i.customer_id, p.phone_number, p.name
    FROM invoices i
    JOIN profiles p ON p.id = i.customer_id
    LEFT JOIN payment_reminders pr
      ON pr.invoice_id = i.id AND pr.reminder_number = 2
    WHERE i.invoice_status IN ('sent', 'partially_paid')
      AND i.due_date::date - CURRENT_DATE = 1
      AND pr.id IS NULL
      AND p.phone_number IS NOT NULL
      AND p.is_active = true
  ),
  sms_inserts_r2 AS (
    INSERT INTO notification_history (user_id, channel, recipient, content, status)
    SELECT
      customer_id,
      'sms',
      phone_number,
      'Reminder: Invoice ' || invoice_number || ' for KES '
        || to_char(total_amount, 'FM999,999,999')
        || ' is due TOMORROW. Please pay via M-Pesa to avoid late fees. - ExpressWash',
      'queued'
    FROM eligible_r2
    RETURNING recipient
  )
  INSERT INTO payment_reminders (invoice_id, reminder_number, channel)
  SELECT invoice_id, 2, 'sms' FROM eligible_r2;

  -- ---- REMINDER 3: 1 day overdue ----
  WITH eligible_r3 AS (
    SELECT i.id AS invoice_id, i.invoice_number, i.total_amount,
           i.customer_id, p.phone_number, p.name
    FROM invoices i
    JOIN profiles p ON p.id = i.customer_id
    LEFT JOIN payment_reminders pr
      ON pr.invoice_id = i.id AND pr.reminder_number = 3
    WHERE i.invoice_status IN ('sent', 'partially_paid', 'overdue')
      AND CURRENT_DATE - i.due_date::date = 1
      AND pr.id IS NULL
      AND p.phone_number IS NOT NULL
      AND p.is_active = true
  ),
  sms_inserts_r3 AS (
    INSERT INTO notification_history (user_id, channel, recipient, content, status)
    SELECT
      customer_id,
      'sms',
      phone_number,
      'OVERDUE: Invoice ' || invoice_number || ' for KES '
        || to_char(total_amount, 'FM999,999,999')
        || ' was due yesterday. Please pay immediately to avoid service interruption. - ExpressWash',
      'queued'
    FROM eligible_r3
    RETURNING recipient
  )
  INSERT INTO payment_reminders (invoice_id, reminder_number, channel)
  SELECT invoice_id, 3, 'sms' FROM eligible_r3;

  -- ---- Also update overdue invoice statuses ----
  UPDATE invoices
  SET invoice_status = 'overdue'
  WHERE invoice_status IN ('sent', 'partially_paid')
    AND due_date::date < CURRENT_DATE;

  $$
);
```

**Verify the job is registered:**
```sql
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'payment-reminders';
```

---

### Task 1.5: Deploy SLA monitoring (every 2 hours)

**File:** `supabase/migrations/20260312_022_cron_sla_monitoring.sql`

```sql
-- ============================================================
-- CRON JOB 3: SLA monitoring
-- Runs every 2 hours
-- Alerts admin when orders approach their SLA deadline
-- ============================================================

SELECT cron.unschedule('sla-monitoring')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sla-monitoring');

SELECT cron.schedule(
  'sla-monitoring',
  '0 */2 * * *',  -- Every 2 hours
  $$

  -- Find orders approaching SLA deadline (within next 4 hours)
  -- but not already delivered/cancelled/refunded
  WITH approaching AS (
    SELECT o.id, o.tracking_code, o.status, o.sla_deadline,
           o.customer_id, p.name AS customer_name
    FROM orders o
    LEFT JOIN profiles p ON p.id = o.customer_id
    WHERE o.sla_deadline IS NOT NULL
      AND o.sla_deadline BETWEEN NOW() AND NOW() + INTERVAL '4 hours'
      AND o.status NOT IN (12, 13, 14) -- Not delivered/cancelled/refunded
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
  -- Alert for approaching deadlines
  INSERT INTO notification_history (user_id, channel, recipient, content, status)
  SELECT
    NULL, -- System notification
    'sms',
    admin_phone.phone_number,
    CASE
      WHEN (SELECT count(*) FROM approaching) > 0 AND (SELECT count(*) FROM breached) > 0 THEN
        '⚠ SLA ALERT: ' || (SELECT count(*) FROM breached) || ' BREACHED, '
        || (SELECT count(*) FROM approaching) || ' approaching. '
        || 'Nearest: ' || COALESCE(
          (SELECT tracking_code FROM approaching ORDER BY sla_deadline LIMIT 1),
          (SELECT tracking_code FROM breached ORDER BY sla_deadline LIMIT 1)
        )
      WHEN (SELECT count(*) FROM breached) > 0 THEN
        '🚨 SLA BREACHED: ' || (SELECT count(*) FROM breached)
        || ' orders past deadline! First: '
        || (SELECT tracking_code FROM breached ORDER BY sla_deadline LIMIT 1)
      WHEN (SELECT count(*) FROM approaching) > 0 THEN
        '⏰ SLA WARNING: ' || (SELECT count(*) FROM approaching)
        || ' orders approaching deadline in next 4h. First: '
        || (SELECT tracking_code FROM approaching ORDER BY sla_deadline LIMIT 1)
      ELSE NULL
    END,
    'queued'
  FROM (
    SELECT phone_number FROM profiles
    WHERE role IN ('admin', 'super_admin') AND is_active = true AND phone_number IS NOT NULL
    LIMIT 1
  ) admin_phone
  WHERE (SELECT count(*) FROM approaching) > 0
     OR (SELECT count(*) FROM breached) > 0;

  $$
);
```

---

### Task 1.6: Deploy warehouse aging alerts (daily 10:00 AM EAT)

**File:** `supabase/migrations/20260312_023_cron_warehouse_aging.sql`

```sql
-- ============================================================
-- CRON JOB 4: Warehouse aging alerts
-- Runs daily at 10:00 AM EAT (7:00 AM UTC)
-- Flags items sitting in warehouse > 7 days without dispatch
-- ============================================================

SELECT cron.unschedule('warehouse-aging')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'warehouse-aging');

SELECT cron.schedule(
  'warehouse-aging',
  '0 7 * * *',  -- 7:00 AM UTC = 10:00 AM EAT
  $$

  WITH aged_items AS (
    SELECT wi.order_id, wi.created_at AS intake_date,
           EXTRACT(DAY FROM NOW() - wi.created_at)::INTEGER AS days_in_warehouse,
           o.tracking_code, o.status
    FROM warehouse_intake wi
    JOIN orders o ON o.id::text = wi.order_id::text
    WHERE wi.created_at < NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM warehouse_dispatch wd
        WHERE wd.order_id = wi.order_id
      )
      AND o.status NOT IN (12, 13, 14) -- Not delivered/cancelled/refunded
  )
  INSERT INTO notification_history (user_id, channel, recipient, content, status)
  SELECT
    NULL,
    'sms',
    admin_phone.phone_number,
    '📦 WAREHOUSE AGING: ' || (SELECT count(*) FROM aged_items)
      || ' items have been in warehouse > 7 days. '
      || 'Oldest: ' || COALESCE(
        (SELECT tracking_code || ' (' || days_in_warehouse || ' days)' FROM aged_items ORDER BY intake_date ASC LIMIT 1),
        'unknown'
      )
      || '. Please review intake queue.',
    'queued'
  FROM (
    SELECT phone_number FROM profiles
    WHERE role IN ('admin', 'super_admin') AND is_active = true AND phone_number IS NOT NULL
    LIMIT 1
  ) admin_phone
  WHERE (SELECT count(*) FROM aged_items) > 0;

  $$
);
```

---

### Task 1.7: Deploy birthday discount automation (daily 6:00 AM EAT)

**File:** `supabase/migrations/20260312_024_cron_birthday_discounts.sql`

```sql
-- ============================================================
-- CRON JOB 5: Birthday discounts
-- Runs daily at 6:00 AM EAT (3:00 AM UTC)
-- Creates a 20% discount promo for customers with birthdays in 7 days
-- Sends a birthday SMS with the promo code
-- ============================================================

SELECT cron.unschedule('birthday-discounts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'birthday-discounts');

SELECT cron.schedule(
  'birthday-discounts',
  '0 3 * * *',  -- 3:00 AM UTC = 6:00 AM EAT
  $$

  -- Find customers with birthdays in 7 days who haven't received a birthday promo this year
  WITH birthday_customers AS (
    SELECT p.id, p.name, p.phone_number, p.email
    FROM profiles p
    WHERE p.birthday IS NOT NULL
      AND p.role = 'customer'
      AND p.is_active = true
      AND EXTRACT(MONTH FROM p.birthday) = EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL '7 days')
      AND EXTRACT(DAY FROM p.birthday) = EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '7 days')
      -- Guard: no birthday promo already created this year for this customer
      AND NOT EXISTS (
        SELECT 1 FROM promotions promo
        WHERE promo.promotion_type = 'birthday'
          AND promo.name LIKE '%' || p.name || '%'
          AND EXTRACT(YEAR FROM promo.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
      )
  ),
  -- Create promo codes
  new_promos AS (
    INSERT INTO promotions (
      name, code, discount_type, discount_value,
      valid_from, valid_until, is_active,
      promotion_type, usage_limit, usage_per_customer,
      created_by
    )
    SELECT
      'Birthday - ' || bc.name,
      'BDAY-' || UPPER(SUBSTR(MD5(bc.id::text || CURRENT_DATE::text), 1, 6)),
      'percentage',
      20.00,  -- 20% off
      NOW(),
      NOW() + INTERVAL '7 days',
      true,
      'birthday',
      1,  -- One-time use
      1,
      (SELECT id FROM profiles WHERE role = 'super_admin' LIMIT 1)
    FROM birthday_customers bc
    RETURNING id, name, code
  )
  -- Queue birthday SMS notifications
  INSERT INTO notification_history (user_id, channel, recipient, content, status)
  SELECT
    bc.id,
    'sms',
    bc.phone_number,
    '🎂 Happy Birthday ' || COALESCE(bc.name, '') || '! '
      || 'ExpressWash wishes you a wonderful day. '
      || 'Enjoy 20% off your next order with code: '
      || np.code || ' (valid 7 days). 🎉',
    'queued'
  FROM birthday_customers bc
  JOIN new_promos np ON np.name = 'Birthday - ' || bc.name
  WHERE bc.phone_number IS NOT NULL;

  $$
);
```

---

### Day 1 Done Criteria

```sql
-- DAY 1 VERIFICATION
DO $$
DECLARE
  job_count INTEGER;
BEGIN
  -- Check pg_cron and pg_net are enabled
  ASSERT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'), 'pg_cron not enabled';
  ASSERT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net'), 'pg_net not enabled';
  RAISE NOTICE '✓ pg_cron and pg_net enabled';

  -- Check all 5 jobs are scheduled
  SELECT count(*) INTO job_count FROM cron.job WHERE active = true;
  ASSERT job_count >= 5, 'Expected >= 5 active cron jobs, found ' || job_count;
  RAISE NOTICE '✓ % active cron jobs found', job_count;

  -- List them
  RAISE NOTICE '';
  RAISE NOTICE 'Scheduled jobs:';
END $$;

SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;

-- Expected output:
-- birthday-discounts        | 0 3 * * *   | t
-- payment-reminders         | 0 6 * * *   | t
-- process-notification-queue| * * * * *   | t
-- sla-monitoring            | 0 */2 * * * | t
-- warehouse-aging           | 0 7 * * *   | t
```

| Check | Verify |
|---|---|
| pg_cron extension enabled | ✅ `SELECT * FROM pg_extension` |
| pg_net extension enabled | ✅ Same |
| Vault secrets (or db settings) configured | ✅ URL + service key accessible |
| 5 cron jobs registered and active | ✅ `SELECT * FROM cron.job` |
| Notification queue processor works automatically | ✅ Insert queued notification, SMS arrives within 90s |

---

## DAY 2 (Tuesday): LOYALTY POINTS FIX + CRON NOTIFICATION TEMPLATES

### What happens today
Fix the loyalty point calculation from flat 50 to value-based (1 point per 100 KES). Add missing notification templates that the cron jobs reference. Verify all cron jobs have the templates they need to send meaningful messages.

---

### Task 2.1: Fix loyalty points — value-based calculation

**File:** `supabase/migrations/20260312_025_fix_loyalty_points.sql`

```sql
-- ============================================================
-- Fix loyalty points: flat 50 → 1 point per 100 KES spent
--
-- This replaces the existing loyalty trigger. The existing trigger
-- (if any) awarded flat 50 points per delivery. The new trigger
-- awards points proportional to order value.
--
-- Tier thresholds:
--   Bronze:   0 - 499 points
--   Silver:   500 - 1,999 points
--   Gold:     2,000 - 4,999 points
--   Platinum: 5,000+ points
-- ============================================================

CREATE OR REPLACE FUNCTION award_loyalty_points_on_delivery()
RETURNS trigger AS $$
DECLARE
  points_earned INTEGER;
  new_balance INTEGER;
  new_tier TEXT;
  account_exists BOOLEAN;
BEGIN
  -- Only fire on transition TO delivered (status 12)
  IF NEW.status != 12 OR OLD.status = 12 THEN
    RETURN NEW;
  END IF;

  -- Calculate points: 1 point per 100 KES (rounded down)
  points_earned := FLOOR(COALESCE(NEW.total_amount, 0) / 100);

  -- Skip if zero points (very small order)
  IF points_earned <= 0 THEN
    RETURN NEW;
  END IF;

  -- Check if loyalty account exists
  SELECT EXISTS (
    SELECT 1 FROM loyalty_accounts WHERE customer_id = NEW.customer_id
  ) INTO account_exists;

  -- Create loyalty account if it doesn't exist
  IF NOT account_exists THEN
    INSERT INTO loyalty_accounts (customer_id, points_balance, total_points_earned, tier)
    VALUES (NEW.customer_id, 0, 0, 'bronze')
    ON CONFLICT (customer_id) DO NOTHING;
  END IF;

  -- Update loyalty account balance
  UPDATE loyalty_accounts
  SET
    points_balance = points_balance + points_earned,
    total_points_earned = total_points_earned + points_earned,
    updated_at = NOW()
  WHERE customer_id = NEW.customer_id
  RETURNING points_balance INTO new_balance;

  -- Handle case where RETURNING didn't capture (shouldn't happen)
  IF new_balance IS NULL THEN
    SELECT points_balance INTO new_balance
    FROM loyalty_accounts WHERE customer_id = NEW.customer_id;
  END IF;

  -- Log the transaction
  INSERT INTO loyalty_transactions (
    customer_id, points, transaction_type, order_id, description, balance_after
  ) VALUES (
    NEW.customer_id,
    points_earned,
    'earned',
    NEW.id,
    points_earned || ' points earned on order ' || COALESCE(NEW.tracking_code, NEW.id::TEXT)
      || ' (KES ' || to_char(NEW.total_amount, 'FM999,999,999') || ')',
    COALESCE(new_balance, points_earned)
  );

  -- Update profile denormalized field
  UPDATE profiles
  SET loyalty_points = COALESCE(new_balance, points_earned)
  WHERE id = NEW.customer_id;

  -- Recalculate tier
  new_tier := CASE
    WHEN COALESCE(new_balance, 0) >= 5000 THEN 'platinum'
    WHEN COALESCE(new_balance, 0) >= 2000 THEN 'gold'
    WHEN COALESCE(new_balance, 0) >= 500 THEN 'silver'
    ELSE 'bronze'
  END;

  UPDATE loyalty_accounts
  SET tier = new_tier
  WHERE customer_id = NEW.customer_id;

  -- Also update profile if it has a loyalty_tier column
  UPDATE profiles
  SET loyalty_tier = new_tier
  WHERE id = NEW.customer_id
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'loyalty_tier'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-bind trigger (drop and recreate to ensure it uses updated function)
DROP TRIGGER IF EXISTS award_loyalty_on_delivery ON orders;

CREATE TRIGGER award_loyalty_on_delivery
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_points_on_delivery();
```

**Verify:**

```sql
-- Test with a mock order delivery
-- Find an order that can be moved to status 12 (or create a test one)

-- Check current loyalty state for a test customer
SELECT p.id, p.name, p.loyalty_points, la.points_balance, la.tier
FROM profiles p
LEFT JOIN loyalty_accounts la ON la.customer_id = p.id
WHERE p.role = 'customer'
LIMIT 3;

-- If you have an order at status 11 (OUT_FOR_DELIVERY), transition to 12:
-- UPDATE orders SET status = 12 WHERE id = '<order_id>' AND status = 11;

-- Then verify:
-- SELECT * FROM loyalty_transactions
-- WHERE order_id = '<order_id>'
-- ORDER BY created_at DESC LIMIT 1;
-- Should show points = FLOOR(total_amount / 100), NOT 50
```

---

### Task 2.2: Seed missing notification templates for cron jobs

The cron jobs send inline message text (not template-based), but some notification paths may reference templates. Ensure templates exist for:
- Payment reminder stages
- SLA alerts (admin-facing)
- Birthday greetings
- Warehouse aging (admin-facing)

**File:** `supabase/migrations/20260312_026_seed_cron_templates.sql`

```sql
-- ============================================================
-- Notification templates for cron-driven messages
-- These are optional (cron jobs build messages inline) but useful
-- if we later switch to template-based rendering for consistency.
-- ============================================================

-- Payment reminder templates (for future template-based approach)
INSERT INTO notification_templates (name, channel, subject, content, is_active)
VALUES
  ('payment_reminder_1', 'sms', NULL,
   'Hi {{customer_name}}, your invoice {{invoice_number}} for KES {{amount}} is due in 4 days. Pay via M-Pesa to avoid delays. - ExpressWash',
   true),
  ('payment_reminder_2', 'sms', NULL,
   'Reminder: Invoice {{invoice_number}} for KES {{amount}} is due TOMORROW. Please pay via M-Pesa. - ExpressWash',
   true),
  ('payment_reminder_3', 'sms', NULL,
   'OVERDUE: Invoice {{invoice_number}} for KES {{amount}} was due yesterday. Please pay immediately. - ExpressWash',
   true),
  ('payment_reminder_1', 'email', 'Payment Due Soon - ExpressWash',
   '<h2>Payment Reminder</h2><p>Hi {{customer_name}},</p><p>Your invoice <strong>{{invoice_number}}</strong> for <strong>KES {{amount}}</strong> is due in 4 days.</p><p>Please make your payment via M-Pesa or bank transfer to avoid any delays to your service.</p><p>Thank you for choosing ExpressWash!</p>',
   true),
  ('payment_reminder_2', 'email', 'Payment Due Tomorrow - ExpressWash',
   '<h2>Urgent: Payment Due Tomorrow</h2><p>Hi {{customer_name}},</p><p>This is a reminder that your invoice <strong>{{invoice_number}}</strong> for <strong>KES {{amount}}</strong> is due <strong>tomorrow</strong>.</p><p>Please make your payment as soon as possible.</p>',
   true),
  ('payment_reminder_3', 'email', 'OVERDUE: Payment Required - ExpressWash',
   '<h2>Payment Overdue</h2><p>Hi {{customer_name}},</p><p>Your invoice <strong>{{invoice_number}}</strong> for <strong>KES {{amount}}</strong> is now <strong>overdue</strong>.</p><p>Please make payment immediately to avoid any disruption to your service.</p>',
   true),
  -- Birthday template
  ('birthday_greeting', 'sms', NULL,
   '🎂 Happy Birthday {{customer_name}}! ExpressWash wishes you a wonderful day. Enjoy 20% off your next order with code: {{promo_code}} (valid 7 days). 🎉',
   true),
  ('birthday_greeting', 'email', 'Happy Birthday from ExpressWash! 🎂',
   '<h2>Happy Birthday, {{customer_name}}! 🎂</h2><p>Wishing you a wonderful birthday from all of us at ExpressWash!</p><p>As a special gift, enjoy <strong>20% off</strong> your next order with code:</p><h3 style="color: #4F46E5; text-align: center;">{{promo_code}}</h3><p>Valid for 7 days. We look forward to serving you!</p>',
   true)
ON CONFLICT (name, channel) DO NOTHING;

-- Verify
SELECT name, channel, is_active FROM notification_templates
WHERE name LIKE 'payment_reminder%' OR name LIKE 'birthday%'
ORDER BY name, channel;
```

---

### Task 2.3: Verify cron job execution logs

pg_cron logs job executions. After the jobs have had time to run (wait until the next scheduled time or trigger manually), check the logs:

```sql
-- Check recent cron job executions
SELECT jobid, runid, job_pid, database, username,
       command, status, return_message,
       start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- Check specifically for notification processor
SELECT j.jobname, jrd.status, jrd.return_message, jrd.start_time
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'process-notification-queue'
ORDER BY jrd.start_time DESC
LIMIT 5;
-- All should show status = 'succeeded'
```

---

### Day 2 Done Criteria

| Check | Verify |
|---|---|
| Loyalty trigger updated to value-based | ✅ `\df award_loyalty_points_on_delivery` shows updated function |
| KES 10,000 order earns 100 points (not 50) | ✅ Test delivery + check loyalty_transactions |
| Tier recalculates correctly | ✅ Customer with 500+ points shows 'silver' |
| All payment reminder templates seeded | ✅ 6 rows (3 SMS + 3 email) |
| Birthday greeting templates seeded | ✅ 2 rows (SMS + email) |
| Cron job execution logs show 'succeeded' | ✅ `cron.job_run_details` |
| Notification queue processor executing every minute | ✅ Regular entries in job_run_details |

---

## DAY 3 (Wednesday): ADMIN ZONE MANAGEMENT + FRONTEND ZONE-AWARE DELIVERY

### What happens today
Build the admin UI for managing zones (CRUD) and update the frontend order/checkout flow to dynamically read delivery fees and policies from the `zones` table instead of hardcoded values.

---

### Task 3.1: Create zone management service

**File:** `src/services/zoneService.ts`

```typescript
import { supabase } from "@/lib/supabase";

export interface Zone {
  id: string;
  name: string;
  delivery_policy: "same_day" | "48_hour";
  delivery_days: string[] | null;
  base_delivery_fee: number;
  cutoff_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ZoneInput {
  name: string;
  delivery_policy: "same_day" | "48_hour";
  delivery_days?: string[] | null;
  base_delivery_fee: number;
  cutoff_time?: string | null;
  is_active?: boolean;
}

// ---- READ (public — all authenticated users) ----

export async function getActiveZones(): Promise<Zone[]> {
  const { data, error } = await supabase
    .from("zones")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`Failed to fetch zones: ${error.message}`);
  return data || [];
}

export async function getZoneByName(name: string): Promise<Zone | null> {
  const { data, error } = await supabase
    .from("zones")
    .select("*")
    .eq("name", name)
    .eq("is_active", true)
    .single();

  if (error && error.code !== "PGRST116") { // PGRST116 = not found
    throw new Error(`Failed to fetch zone: ${error.message}`);
  }
  return data;
}

/**
 * Calculate delivery fee and estimated delivery based on zone.
 * This replaces hardcoded zone logic in the frontend.
 */
export function calculateDeliveryInfo(zone: Zone): {
  fee: number;
  estimatedDelivery: string;
  nextDeliveryDate: Date | null;
} {
  const fee = zone.base_delivery_fee;

  if (zone.delivery_policy === "same_day") {
    // Check if before cutoff time
    const now = new Date();
    const [cutoffH, cutoffM] = (zone.cutoff_time || "12:00:00").split(":").map(Number);
    const cutoff = new Date();
    cutoff.setHours(cutoffH, cutoffM, 0, 0);

    if (now < cutoff) {
      return {
        fee,
        estimatedDelivery: "Same-day delivery (by 6 PM)",
        nextDeliveryDate: now,
      };
    } else {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return {
        fee,
        estimatedDelivery: "Next-day delivery (ordered after cutoff)",
        nextDeliveryDate: tomorrow,
      };
    }
  }

  // 48-hour delivery policy
  if (zone.delivery_policy === "48_hour" && zone.delivery_days) {
    const dayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    const deliveryDayNumbers = zone.delivery_days.map((d) => dayMap[d.toLowerCase()]);
    const now = new Date();
    const today = now.getDay();

    // Find next delivery day that's at least 2 days from now
    let nextDate: Date | null = null;
    for (let i = 2; i <= 9; i++) {
      const candidateDate = new Date(now);
      candidateDate.setDate(candidateDate.getDate() + i);
      if (deliveryDayNumbers.includes(candidateDate.getDay())) {
        nextDate = candidateDate;
        break;
      }
    }

    const dayNames = zone.delivery_days.map(
      (d) => d.charAt(0).toUpperCase() + d.slice(1)
    );

    return {
      fee,
      estimatedDelivery: `Delivery on ${dayNames.join(", ")} (48-hour processing)`,
      nextDeliveryDate: nextDate,
    };
  }

  return { fee, estimatedDelivery: "Standard delivery", nextDeliveryDate: null };
}

// ---- ADMIN CRUD ----

export async function getAllZones(): Promise<Zone[]> {
  const { data, error } = await supabase
    .from("zones")
    .select("*")
    .order("name");

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createZone(input: ZoneInput): Promise<Zone> {
  const { data, error } = await supabase
    .from("zones")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(`Failed to create zone: ${error.message}`);
  return data;
}

export async function updateZone(id: string, input: Partial<ZoneInput>): Promise<Zone> {
  const { data, error } = await supabase
    .from("zones")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update zone: ${error.message}`);
  return data;
}

export async function toggleZoneActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("zones")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`Failed to toggle zone: ${error.message}`);
}
```

---

### Task 3.2: Build admin zone management component

This should be integrated into the existing admin settings or pricing page. Create a dedicated component:

**File:** `src/components/admin/ZoneManagement.tsx`

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllZones, createZone, updateZone, toggleZoneActive,
  type Zone, type ZoneInput
} from "@/services/zoneService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

const DELIVERY_DAYS = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

export function ZoneManagement() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["admin-zones"],
    queryFn: getAllZones,
  });

  const createMutation = useMutation({
    mutationFn: createZone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
      toast.success("Zone created");
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ZoneInput> }) =>
      updateZone(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
      toast.success("Zone updated");
      setDialogOpen(false);
      setEditingZone(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleZoneActive(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-zones"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const policy = form.get("delivery_policy") as string;

    const input: ZoneInput = {
      name: form.get("name") as string,
      delivery_policy: policy as "same_day" | "48_hour",
      base_delivery_fee: Number(form.get("base_delivery_fee")),
      cutoff_time: policy === "same_day" ? (form.get("cutoff_time") as string) || "12:00" : null,
      delivery_days: policy === "48_hour"
        ? DELIVERY_DAYS.filter((d) => form.get(`day_${d}`) === "on")
        : null,
    };

    if (editingZone) {
      updateMutation.mutate({ id: editingZone.id, input });
    } else {
      createMutation.mutate(input);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Delivery Zones</h3>
          <p className="text-sm text-muted-foreground">
            Manage delivery areas, fees, and scheduling policies
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingZone(null);
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Zone
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingZone ? "Edit Zone" : "Add Delivery Zone"}
              </DialogTitle>
            </DialogHeader>
            <ZoneForm
              zone={editingZone}
              onSubmit={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading zones...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zone</TableHead>
              <TableHead>Policy</TableHead>
              <TableHead>Delivery Days</TableHead>
              <TableHead>Fee (KES)</TableHead>
              <TableHead>Cutoff</TableHead>
              <TableHead>Active</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zones.map((zone) => (
              <TableRow key={zone.id}>
                <TableCell className="font-medium">{zone.name}</TableCell>
                <TableCell>
                  <Badge variant={zone.delivery_policy === "same_day" ? "default" : "secondary"}>
                    {zone.delivery_policy === "same_day" ? "Same Day" : "48 Hour"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {zone.delivery_days?.map((d) => d.slice(0, 3).toUpperCase()).join(", ") || "—"}
                </TableCell>
                <TableCell>{zone.base_delivery_fee.toLocaleString()}</TableCell>
                <TableCell>{zone.cutoff_time?.slice(0, 5) || "—"}</TableCell>
                <TableCell>
                  <Switch
                    checked={zone.is_active}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: zone.id, active: checked })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { setEditingZone(zone); setDialogOpen(true); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ---- ZONE FORM (used for create and edit) ----
function ZoneForm({
  zone,
  onSubmit,
  loading,
}: {
  zone: Zone | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean;
}) {
  const [policy, setPolicy] = useState(zone?.delivery_policy || "same_day");

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Zone Name</Label>
        <Input id="name" name="name" defaultValue={zone?.name || ""} required placeholder="e.g. Kitengela" />
      </div>

      <div className="space-y-2">
        <Label>Delivery Policy</Label>
        <Select name="delivery_policy" defaultValue={policy} onValueChange={setPolicy}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="same_day">Same Day</SelectItem>
            <SelectItem value="48_hour">48 Hour</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="base_delivery_fee">Delivery Fee (KES)</Label>
        <Input
          id="base_delivery_fee" name="base_delivery_fee" type="number"
          defaultValue={zone?.base_delivery_fee || 200} required min={0}
        />
      </div>

      {policy === "same_day" && (
        <div className="space-y-2">
          <Label htmlFor="cutoff_time">Same-Day Cutoff Time</Label>
          <Input
            id="cutoff_time" name="cutoff_time" type="time"
            defaultValue={zone?.cutoff_time?.slice(0, 5) || "12:00"}
          />
          <p className="text-xs text-muted-foreground">Orders after this time go to next-day</p>
        </div>
      )}

      {policy === "48_hour" && (
        <div className="space-y-2">
          <Label>Delivery Days</Label>
          <div className="flex flex-wrap gap-3">
            {DELIVERY_DAYS.map((day) => (
              <label key={day} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox" name={`day_${day}`}
                  defaultChecked={zone?.delivery_days?.includes(day)}
                  className="rounded"
                />
                {day.charAt(0).toUpperCase() + day.slice(1, 3)}
              </label>
            ))}
          </div>
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Saving..." : zone ? "Update Zone" : "Create Zone"}
      </Button>
    </form>
  );
}
```

**Integration:** Import `<ZoneManagement />` into the admin settings or pricing page where zone configuration belongs. The exact location depends on your admin layout — likely `src/pages/admin/Settings.tsx` or a dedicated `src/pages/admin/Pricing.tsx`.

---

### Task 3.3: Update frontend order flow to use zones dynamically

Find where the frontend currently hardcodes delivery fees or zone logic. Replace with dynamic zone lookup.

**Pattern to find and replace** — search codebase for:
- Hardcoded delivery fee amounts (200, 250, 350)
- Hardcoded zone names with conditions
- Any `deliveryFee` assignment that doesn't read from the DB

**Create a hook for convenience:**

**File:** `src/hooks/useZones.ts`

```typescript
import { useQuery } from "@tanstack/react-query";
import { getActiveZones, getZoneByName, calculateDeliveryInfo, type Zone } from "@/services/zoneService";

export function useActiveZones() {
  return useQuery({
    queryKey: ["active-zones"],
    queryFn: getActiveZones,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes — zones rarely change
  });
}

export function useZoneDeliveryInfo(zoneName: string | null) {
  const { data: zones } = useActiveZones();

  if (!zoneName || !zones) return null;

  const zone = zones.find((z) => z.name === zoneName);
  if (!zone) return null;

  return calculateDeliveryInfo(zone);
}
```

**In the order creation / checkout page,** replace hardcoded logic:

```typescript
// BEFORE (hardcoded):
// const deliveryFee = zone === "Greater Nairobi" ? 350 : 200;

// AFTER (dynamic):
import { useActiveZones, useZoneDeliveryInfo } from "@/hooks/useZones";

// In the component:
const { data: zones = [] } = useActiveZones();
const deliveryInfo = useZoneDeliveryInfo(selectedZone);

// Use in the form:
// deliveryInfo?.fee for the delivery fee amount
// deliveryInfo?.estimatedDelivery for the ETA text
// deliveryInfo?.nextDeliveryDate for the calendar/date picker

// Zone selector dropdown reads from DB:
<Select value={selectedZone} onValueChange={setSelectedZone}>
  <SelectTrigger><SelectValue placeholder="Select delivery zone" /></SelectTrigger>
  <SelectContent>
    {zones.map((zone) => (
      <SelectItem key={zone.id} value={zone.name}>
        {zone.name} — KES {zone.base_delivery_fee.toLocaleString()}
        {zone.delivery_policy === "same_day" ? " (Same Day)" : " (48hr)"}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

### Day 3 Done Criteria

| Check | Verify |
|---|---|
| `zoneService.ts` created | ✅ File exists with CRUD + delivery calculation |
| Admin zone table displays all 3 seeded zones | ✅ Table renders in admin UI |
| Admin can create a new zone | ✅ Insert persists to DB, table refreshes |
| Admin can edit zone fee/policy | ✅ Update persists |
| Admin can toggle zone active/inactive | ✅ Switch works |
| Frontend zone selector reads from DB | ✅ Dropdown shows zones from `zones` table |
| Delivery fee updates dynamically when zone changes | ✅ Fee and ETA change in real-time |
| No hardcoded delivery fees remain in order flow | ✅ `grep -r "200\|350" src/` finds no delivery fee hardcodes |

---

## DAY 4 (Thursday): PROMOTIONS ADMIN CRUD + CHECKOUT VALIDATION

### What happens today
Build the admin interface for creating and managing promotion codes. Wire promotion code validation into the checkout flow so customers can apply codes and get server-validated discounts.

---

### Task 4.1: Create promotions service

**File:** `src/services/promotionService.ts`

```typescript
import { supabase } from "@/lib/supabase";

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  code: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  usage_limit: number | null;
  usage_per_customer: number;
  times_used: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  promotion_type: "manual" | "birthday" | "referral" | "seasonal" | "winback";
  created_at: string;
}

export interface PromotionInput {
  name: string;
  description?: string;
  code: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  min_order_amount?: number | null;
  max_discount_amount?: number | null;
  usage_limit?: number | null;
  usage_per_customer?: number;
  valid_from: string;
  valid_until: string;
  promotion_type?: string;
}

// ---- ADMIN CRUD ----

export async function getAllPromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createPromotion(input: PromotionInput): Promise<Promotion> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("promotions")
    .insert({
      ...input,
      code: input.code.toUpperCase().trim(),
      is_active: true,
      times_used: 0,
      promotion_type: input.promotion_type || "manual",
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") { // Unique violation
      throw new Error(`Promotion code "${input.code}" already exists`);
    }
    throw new Error(`Failed to create promotion: ${error.message}`);
  }
  return data;
}

export async function updatePromotion(id: string, input: Partial<PromotionInput>): Promise<Promotion> {
  const update: any = { ...input };
  if (input.code) update.code = input.code.toUpperCase().trim();

  const { data, error } = await supabase
    .from("promotions")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update: ${error.message}`);
  return data;
}

export async function togglePromotionActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("promotions")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function getPromotionUsage(promotionId: string) {
  const { data, error } = await supabase
    .from("promotion_usage")
    .select("*, profiles!customer_id(name, phone_number)")
    .eq("promotion_id", promotionId)
    .order("used_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ---- CUSTOMER-FACING: VALIDATE PROMO CODE ----

/**
 * Validate a promo code client-side (basic checks) before the server-side
 * pricing function does the authoritative validation.
 * Returns the promotion details if valid, null if invalid.
 */
export async function validatePromoCode(code: string): Promise<{
  valid: boolean;
  promotion?: Promotion;
  message: string;
}> {
  if (!code || code.trim().length === 0) {
    return { valid: false, message: "Please enter a promo code" };
  }

  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return { valid: false, message: "Invalid promo code" };
  }

  const now = new Date();
  const validFrom = new Date(data.valid_from);
  const validUntil = new Date(data.valid_until);

  if (now < validFrom) {
    return { valid: false, message: "This promo code is not yet active" };
  }
  if (now > validUntil) {
    return { valid: false, message: "This promo code has expired" };
  }
  if (data.usage_limit !== null && data.times_used >= data.usage_limit) {
    return { valid: false, message: "This promo code has been fully redeemed" };
  }

  // Check per-customer usage
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { count } = await supabase
      .from("promotion_usage")
      .select("*", { count: "exact", head: true })
      .eq("promotion_id", data.id)
      .eq("customer_id", user.id);

    if (count !== null && count >= data.usage_per_customer) {
      return { valid: false, message: "You have already used this promo code" };
    }
  }

  const discountText = data.discount_type === "percentage"
    ? `${data.discount_value}% off`
    : `KES ${data.discount_value.toLocaleString()} off`;

  return {
    valid: true,
    promotion: data,
    message: `${discountText} applied!${data.min_order_amount ? ` (Min order: KES ${data.min_order_amount.toLocaleString()})` : ""}`,
  };
}

/**
 * Record that a promotion was used (call after order is created).
 */
export async function recordPromotionUsage(
  promotionId: string,
  orderId: string,
  discountApplied: number
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Insert usage record
  await supabase.from("promotion_usage").insert({
    promotion_id: promotionId,
    customer_id: user.id,
    order_id: orderId,
    discount_applied: discountApplied,
  });

  // Increment times_used counter
  await supabase.rpc("increment_promotion_usage", { p_promotion_id: promotionId });
}
```

**Database helper for atomic increment:**

**File:** `supabase/migrations/20260312_027_promotion_usage_increment.sql`

```sql
-- Atomic increment for promotion usage counter
CREATE OR REPLACE FUNCTION increment_promotion_usage(p_promotion_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE promotions
  SET times_used = times_used + 1
  WHERE id = p_promotion_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_promotion_usage TO authenticated;
```

---

### Task 4.2: Build admin promotions management component

**File:** `src/components/admin/PromotionManagement.tsx`

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllPromotions, createPromotion, updatePromotion, togglePromotionActive,
  type Promotion, type PromotionInput,
} from "@/services/promotionService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Copy, Gift, Percent, DollarSign } from "lucide-react";
import { toast } from "sonner";

export function PromotionManagement() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ["admin-promotions"],
    queryFn: getAllPromotions,
  });

  const createMutation = useMutation({
    mutationFn: createPromotion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
      toast.success("Promotion created");
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PromotionInput> }) =>
      updatePromotion(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
      toast.success("Promotion updated");
      setDialogOpen(false);
      setEditingPromo(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      togglePromotionActive(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-promotions"] }),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const input: PromotionInput = {
      name: form.get("name") as string,
      description: (form.get("description") as string) || undefined,
      code: form.get("code") as string,
      discount_type: form.get("discount_type") as "percentage" | "fixed_amount",
      discount_value: Number(form.get("discount_value")),
      min_order_amount: form.get("min_order_amount")
        ? Number(form.get("min_order_amount")) : null,
      max_discount_amount: form.get("max_discount_amount")
        ? Number(form.get("max_discount_amount")) : null,
      usage_limit: form.get("usage_limit")
        ? Number(form.get("usage_limit")) : null,
      usage_per_customer: Number(form.get("usage_per_customer")) || 1,
      valid_from: (form.get("valid_from") as string) + "T00:00:00Z",
      valid_until: (form.get("valid_until") as string) + "T23:59:59Z",
      promotion_type: "manual",
    };

    if (editingPromo) {
      updateMutation.mutate({ id: editingPromo.id, input });
    } else {
      createMutation.mutate(input);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success(`Copied: ${code}`);
  }

  const now = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Promotion Codes</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage discount codes for customers
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingPromo(null);
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> New Promotion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingPromo ? "Edit Promotion" : "Create Promotion"}
              </DialogTitle>
            </DialogHeader>
            <PromotionForm
              promo={editingPromo}
              onSubmit={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading promotions...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Valid Period</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Active</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promotions.map((promo) => {
              const isExpired = new Date(promo.valid_until) < now;
              const isExhausted = promo.usage_limit !== null && promo.times_used >= promo.usage_limit;

              return (
                <TableRow key={promo.id} className={isExpired ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{promo.name}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => copyCode(promo.code)}
                      className="font-mono text-sm bg-muted px-2 py-0.5 rounded hover:bg-muted/80 inline-flex items-center gap-1"
                    >
                      {promo.code} <Copy className="h-3 w-3" />
                    </button>
                  </TableCell>
                  <TableCell>
                    {promo.discount_type === "percentage" ? (
                      <span className="inline-flex items-center gap-1">
                        <Percent className="h-3 w-3" /> {promo.discount_value}%
                      </span>
                    ) : (
                      <span>KES {promo.discount_value.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {promo.times_used}{promo.usage_limit ? ` / ${promo.usage_limit}` : ""}
                    {isExhausted && <Badge variant="destructive" className="ml-1 text-xs">Full</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(promo.valid_from).toLocaleDateString()} —{" "}
                    {new Date(promo.valid_until).toLocaleDateString()}
                    {isExpired && <Badge variant="outline" className="ml-1 text-xs">Expired</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {promo.promotion_type === "birthday" && <Gift className="h-3 w-3 mr-1" />}
                      {promo.promotion_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={promo.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: promo.id, active: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm"
                      onClick={() => { setEditingPromo(promo); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ---- PROMOTION FORM ----
function PromotionForm({
  promo,
  onSubmit,
  loading,
}: {
  promo: Promotion | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean;
}) {
  const [discountType, setDiscountType] = useState(promo?.discount_type || "percentage");

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Promotion Name</Label>
          <Input id="name" name="name" defaultValue={promo?.name || ""} required
            placeholder="e.g. Rainy Season Sale" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Promo Code</Label>
          <Input id="code" name="code"
            defaultValue={promo?.code || ""}
            required placeholder="e.g. RAINY20"
            className="font-mono uppercase"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={2}
          defaultValue={promo?.description || ""}
          placeholder="Internal notes about this promotion" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Discount Type</Label>
          <Select name="discount_type" defaultValue={discountType} onValueChange={setDiscountType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="fixed_amount">Fixed Amount (KES)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="discount_value">
            {discountType === "percentage" ? "Discount %" : "Discount Amount (KES)"}
          </Label>
          <Input id="discount_value" name="discount_value" type="number" required
            defaultValue={promo?.discount_value || ""}
            min={0} max={discountType === "percentage" ? 100 : undefined}
            placeholder={discountType === "percentage" ? "20" : "500"} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="min_order_amount">Min Order (KES, optional)</Label>
          <Input id="min_order_amount" name="min_order_amount" type="number"
            defaultValue={promo?.min_order_amount || ""} min={0}
            placeholder="No minimum" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max_discount_amount">Max Discount Cap (KES, optional)</Label>
          <Input id="max_discount_amount" name="max_discount_amount" type="number"
            defaultValue={promo?.max_discount_amount || ""} min={0}
            placeholder="No cap" />
          <p className="text-xs text-muted-foreground">For % discounts — cap the maximum savings</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="usage_limit">Total Usage Limit (optional)</Label>
          <Input id="usage_limit" name="usage_limit" type="number"
            defaultValue={promo?.usage_limit || ""} min={1}
            placeholder="Unlimited" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="usage_per_customer">Uses Per Customer</Label>
          <Input id="usage_per_customer" name="usage_per_customer" type="number"
            defaultValue={promo?.usage_per_customer || 1} min={1} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="valid_from">Valid From</Label>
          <Input id="valid_from" name="valid_from" type="date" required
            defaultValue={promo ? promo.valid_from.split("T")[0] : new Date().toISOString().split("T")[0]} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valid_until">Valid Until</Label>
          <Input id="valid_until" name="valid_until" type="date" required
            defaultValue={promo?.valid_until.split("T")[0] || ""} />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Saving..." : promo ? "Update Promotion" : "Create Promotion"}
      </Button>
    </form>
  );
}
```

**Integration:** Add `<PromotionManagement />` to the admin marketing page or a dedicated promotions section.

---

### Task 4.3: Wire promo code input into checkout

Find the order creation / checkout page. Add a promo code input field that validates in real-time and passes the code to `calculate_order_pricing()`.

**Component to add to the checkout page:**

```tsx
import { useState } from "react";
import { validatePromoCode } from "@/services/promotionService";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Tag } from "lucide-react";

interface PromoCodeInputProps {
  onApply: (code: string | null, promotionId: string | null) => void;
}

export function PromoCodeInput({ onApply }: PromoCodeInputProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; message: string } | null>(null);

  async function handleApply() {
    if (!code.trim()) return;

    setLoading(true);
    try {
      const validation = await validatePromoCode(code);
      setResult(validation);

      if (validation.valid && validation.promotion) {
        onApply(code.toUpperCase().trim(), validation.promotion.id);
      } else {
        onApply(null, null);
      }
    } catch {
      setResult({ valid: false, message: "Failed to validate code" });
      onApply(null, null);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setCode("");
    setResult(null);
    onApply(null, null);
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-1.5">
        <Tag className="h-4 w-4" /> Promo Code
      </label>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (result) setResult(null); // Clear result on edit
          }}
          placeholder="Enter code"
          className="font-mono uppercase"
          disabled={result?.valid}
        />
        {result?.valid ? (
          <Button variant="outline" onClick={handleClear} size="sm">
            Clear
          </Button>
        ) : (
          <Button onClick={handleApply} disabled={loading || !code.trim()} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
          </Button>
        )}
      </div>
      {result && (
        <p className={`text-sm flex items-center gap-1 ${result.valid ? "text-green-600" : "text-red-500"}`}>
          {result.valid ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          {result.message}
        </p>
      )}
    </div>
  );
}
```

**In the checkout page, wire it together:**

```typescript
const [promoCode, setPromoCode] = useState<string | null>(null);
const [promotionId, setPromotionId] = useState<string | null>(null);

// In the order summary section:
<PromoCodeInput onApply={(code, id) => {
  setPromoCode(code);
  setPromotionId(id);
}} />

// When calculating price preview:
const serverPricing = await calculateServerPrice(items, selectedZone, promoCode);

// After order is created successfully:
if (promotionId && serverPricing.discount_amount > 0) {
  await recordPromotionUsage(promotionId, newOrderId, serverPricing.discount_amount);
}
```

---

### Day 4 Done Criteria

| Check | Verify |
|---|---|
| `promotionService.ts` created with CRUD + validation | ✅ |
| Admin can create a promo code (e.g. RAINY20, 20% off) | ✅ Persists to DB |
| Admin can edit promo details | ✅ |
| Admin can toggle promo active/inactive | ✅ |
| Admin sees usage count update when promo is used | ✅ |
| Customer can enter promo code at checkout | ✅ Input field appears |
| Valid code shows green "X% off applied!" | ✅ |
| Invalid/expired/exhausted code shows red error | ✅ |
| Discount reflected in order pricing (server-side) | ✅ `calculate_order_pricing()` applies discount |
| Promotion usage recorded after order creation | ✅ Row in `promotion_usage` |
| `increment_promotion_usage` DB function exists | ✅ |

---

## DAY 5 (Friday): COMPREHENSIVE AUTOMATION + INTEGRATION TESTING

### What happens today
Test every automated process end-to-end. Verify all cron jobs work correctly. Test promotion + zone + loyalty flows in combination. Fix any issues found.

---

### Task 5.1: Cron job execution verification

Check that all 5 cron jobs are executing on schedule:

```sql
-- Check execution history for all jobs in the last 24 hours
SELECT j.jobname, jrd.status, jrd.return_message,
       jrd.start_time, jrd.end_time,
       EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) AS duration_seconds
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE jrd.start_time > NOW() - INTERVAL '24 hours'
ORDER BY jrd.start_time DESC
LIMIT 50;

-- Summary: count of successes vs failures per job
SELECT j.jobname,
       COUNT(*) FILTER (WHERE jrd.status = 'succeeded') AS successes,
       COUNT(*) FILTER (WHERE jrd.status = 'failed') AS failures,
       COUNT(*) AS total_runs
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE jrd.start_time > NOW() - INTERVAL '24 hours'
GROUP BY j.jobname
ORDER BY j.jobname;
```

**Every job should show 0 failures.** If any job failed, check `return_message` for the error.

---

### Task 5.2: Payment reminder simulation

To test the payment reminder without waiting for real invoices to age:

```sql
-- Create a test invoice that is due in exactly 4 days
INSERT INTO invoices (
  order_id, invoice_number, amount, total_amount,
  invoice_status, due_date, customer_id, created_at
)
SELECT
  o.id,
  'INV-TEST-REMINDER-' || SUBSTR(MD5(RANDOM()::TEXT), 1, 4),
  1000, 1000,
  'sent',
  (CURRENT_DATE + INTERVAL '4 days')::TIMESTAMPTZ,
  o.customer_id,
  NOW()
FROM orders o
JOIN profiles p ON p.id = o.customer_id
WHERE p.phone_number IS NOT NULL
LIMIT 1;

-- Now manually trigger the payment-reminders cron job
-- (or wait until 6:00 AM UTC tomorrow)
-- To test immediately, copy the job's SQL body and run it directly:

-- [paste the reminder SQL from Task 1.4 here]

-- Then check:
SELECT * FROM notification_history
WHERE content LIKE '%due in 4 days%'
ORDER BY created_at DESC LIMIT 5;
-- Should see a queued SMS

SELECT * FROM payment_reminders
ORDER BY sent_at DESC LIMIT 5;
-- Should see reminder_number = 1 recorded
```

Wait for the notification queue processor to send it (or trigger `send-notification` manually). Verify SMS arrives.

---

### Task 5.3: SLA monitoring simulation

```sql
-- Create an order with an SLA deadline 2 hours from now
UPDATE orders
SET sla_deadline = NOW() + INTERVAL '2 hours'
WHERE id = (SELECT id FROM orders WHERE status NOT IN (12, 13, 14) LIMIT 1);

-- Run the SLA monitoring SQL manually (or wait for next 2-hour cycle)
-- Check notification_history for SLA alert:
SELECT * FROM notification_history
WHERE content LIKE '%SLA%'
ORDER BY created_at DESC LIMIT 5;
```

---

### Task 5.4: Birthday discount simulation

```sql
-- Set a test customer's birthday to 7 days from now
UPDATE profiles
SET birthday = (
  MAKE_DATE(2000, -- Birth year doesn't matter for month/day matching
    EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL '7 days')::INT,
    EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '7 days')::INT
  )
)
WHERE role = 'customer' AND is_active = true
LIMIT 1
RETURNING name, birthday;

-- Run the birthday discount SQL manually
-- Then check:
SELECT * FROM promotions
WHERE promotion_type = 'birthday'
ORDER BY created_at DESC LIMIT 5;
-- Should see a new "Birthday - [name]" promotion with a BDAY-XXXXXX code

SELECT * FROM notification_history
WHERE content LIKE '%Birthday%'
ORDER BY created_at DESC LIMIT 5;
-- Should see a queued birthday SMS
```

---

### Task 5.5: Full combo test — zone + promo + loyalty

This tests the entire Week 3 in one flow:

1. **As admin:** Create a promo code "TESTWEEK3" for 15% off, min KES 1,000, max discount KES 500

2. **As customer:** Start a new order
   - Select zone "Greater Nairobi" from the dynamic zone dropdown
   - ✅ Delivery fee shows KES 350 (from zones table)
   - ✅ Estimated delivery shows "Delivery on Mon, Wed, Fri (48-hour processing)"
   - Add a carpet (120×96 inches)
   - Enter promo code "TESTWEEK3"
   - ✅ Shows "15% off applied!"
   - ✅ Price breakdown shows discount (capped at KES 500)
   - Place the order

3. **Verify in database:**
   ```sql
   -- Order total uses server-side price (not frontend estimate)
   SELECT id, total_amount, discount_amount FROM orders ORDER BY created_at DESC LIMIT 1;

   -- Promotion usage recorded
   SELECT * FROM promotion_usage ORDER BY used_at DESC LIMIT 1;

   -- Promotion times_used incremented
   SELECT code, times_used FROM promotions WHERE code = 'TESTWEEK3';
   ```

4. **As admin:** Move the order through the pipeline to DELIVERED (status 12)

5. **Verify loyalty points:**
   ```sql
   -- Should show points = FLOOR(total_amount / 100), NOT 50
   SELECT * FROM loyalty_transactions ORDER BY created_at DESC LIMIT 1;

   -- Profile loyalty_points updated
   SELECT name, loyalty_points FROM profiles WHERE id = '<customer_id>';
   ```

---

### Day 5 Done Criteria

| Check | Result |
|---|---|
| All 5 cron jobs show 'succeeded' in execution logs | ✅ |
| Notification queue processor runs every minute consistently | ✅ |
| Payment reminder SMS sent for test invoice due in 4 days | ✅ |
| SLA alert SMS sent to admin for approaching deadline | ✅ |
| Birthday promo code created automatically | ✅ |
| Birthday SMS queued with promo code | ✅ |
| Zone selector reads from DB, fees update dynamically | ✅ |
| Admin can create/edit zones | ✅ |
| Admin can create/edit/toggle promo codes | ✅ |
| Customer promo code validation works at checkout | ✅ |
| Discount applies correctly (server-side, capped) | ✅ |
| Promotion usage tracked and counter incremented | ✅ |
| Loyalty points value-based (1 per 100 KES) | ✅ |
| Tier recalculation works | ✅ |
| Warehouse aging alert fires for items > 7 days | ✅ |
| No cron job failures in last 24 hours | ✅ |

---

## WEEK 3 COMPLETE — WHAT YOU HAVE

By end of Friday, the system has gained:

1. **5 automated cron jobs** running unattended:
   - Notification queue processor (every minute)
   - Payment reminders (daily 9 AM EAT — 3-stage escalation)
   - SLA monitoring (every 2 hours — alerts admin on approaching/breached deadlines)
   - Warehouse aging alerts (daily 10 AM EAT — flags items > 7 days)
   - Birthday discounts (daily 6 AM EAT — auto-generates promo codes + sends SMS)

2. **Value-based loyalty points** — 1 point per KES 100 spent (replaces flat 50). Tier auto-recalculation (Bronze → Silver → Gold → Platinum).

3. **Admin zone management** — full CRUD for delivery zones with policy (same-day / 48-hour), delivery days, fees, and cutoff times. Frontend reads zones dynamically instead of hardcoded values.

4. **Promotions system** — admin creates promo codes (percentage or fixed, with min order, max cap, usage limits, per-customer limits, expiry). Customers enter codes at checkout with real-time validation. Server-side `calculate_order_pricing()` applies the discount authoritatively. Usage tracked in `promotion_usage`.

5. **Invoice auto-overdue** — payment reminders cron also updates invoice status to 'overdue' when past due date.

### What's next (Week 4)

- Driver PWA setup (manifest, service worker, installability, push notifications)
- Replace static report data with real aggregation queries
- Wire up remaining admin pages (marketing campaign list, notification preferences)