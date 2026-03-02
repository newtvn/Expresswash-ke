# ExpressWash — Complete Setup Guide (From Scratch)

Follow every step in order. Do not skip ahead.

---

## Phase 1: External Accounts

### 1.1 — Africa's Talking (SMS)

1. Create an account at <https://africastalking.com>
2. Get your API key from the dashboard
3. Register sender ID `EXPRESSWASH` (takes 1–3 business days for approval)
4. **For development:** use sandbox mode — set username to `sandbox` and use the sandbox API key. No sender ID approval needed.

### 1.2 — Resend (Email)

1. Create an account at <https://resend.com>
2. Add and verify domain `expresswash.co.ke` (add the DNS TXT record they provide)
3. Get your API key from the dashboard
4. **Note:** Until the domain is verified, you can only send to your own email address

### 1.3 — Sentry (Error Monitoring)

1. Create a project at <https://sentry.io> (select **React** as platform)
2. Copy the DSN from **Project Settings → Client Keys**

### 1.4 — Google Maps (Optional — for driver location tracking)

1. Go to <https://console.cloud.google.com/>
2. Enable: **Maps JavaScript API**, **Geocoding API**
3. Create an API key

### 1.5 — Google OAuth (for "Sign in with Google")

1. In the same Google Cloud project, go to **APIs & Services → Credentials**
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add authorized redirect URIs:
   - `https://<your-supabase-project>.supabase.co/auth/v1/callback`
   - `http://localhost:5173` (for local dev)
   - Your production domain (e.g. `https://expresswash.co.ke/auth/callback`)
4. Copy the **Client ID** and **Client Secret** — you'll need them in Phase 3

### 1.6 — M-Pesa via Credit Bank (STK Push payments)

1. Register with Credit Bank at <https://creditbank.co.ke>
2. Apply for M-Pesa STK Push integration
3. Get your **Consumer Key** and **Consumer Secret**
4. Note the **API base URL** (e.g. `https://api.creditbank.co.ke`)
5. You'll configure the callback URL later in Phase 5

### 1.7 — VAPID Keys (Web Push notifications)

Generate a VAPID key pair for browser push notifications:

```bash
npx web-push generate-vapid-keys
```

Save both the **public key** and **private key** — you'll need them in Phase 2 and Phase 5.

---

## Phase 2: Local Environment

### 2.1 — Clone and install

```bash
git clone <your-repo-url>
cd Expresswash-ke
npm install
```

### 2.2 — Create your `.env` file

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key-from-step-1.7
```

### 2.3 — Install the Supabase CLI

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>
```

---

## Phase 3: Supabase Dashboard Setup

Do these in the **Supabase Dashboard** before running any migrations.

### 3.1 — Enable extensions

Go to **Database → Extensions** and enable:

- `pg_cron`
- `pg_net`

### 3.2 — Create Vault secrets

Run these in the **SQL Editor**:

```sql
SELECT vault.create_secret('https://<your-project-ref>.supabase.co', 'supabase_url');
SELECT vault.create_secret('<your-service-role-key>', 'service_role_key');
```

### 3.3 — Configure Auth providers and URLs

**Site URL and redirects** — go to **Authentication → URL Configuration**:

- Site URL: `http://localhost:5173` (dev) or `https://expresswash.co.ke` (prod)
- Redirect URLs — add all of:
  - `http://localhost:5173/`
  - `https://your-production-domain.co.ke/`
  - `https://your-production-domain.co.ke/auth/callback`

**Google OAuth** — go to **Authentication → Providers → Google**:

1. Enable Google provider
2. Enter the **Client ID** and **Client Secret** from step 1.5

### 3.4 — Create the `documents` storage bucket

1. Go to **Storage → New Bucket**
2. Name: `documents`
3. Public: **No** (private — signed URLs are used)
4. File size limit: 10 MB

Then add storage policies on the bucket's **Policies** tab:

- **INSERT** policy: allow `service_role`
- **SELECT** policy: allow `authenticated` users (so signed URLs work)

---

## Phase 4: Run Migrations

Run each migration file in the **SQL Editor**, one at a time, in this exact order.
All files are in `supabase/migrations/`.

> **Important:** The base tables (`orders`, `payments`, `profiles`, `system_config`, etc.) must already exist in your Supabase project before running any migrations. These are created during initial project setup.

### Pre-WK1 Migrations (run these first)

| # | File | What it does |
|---|------|-------------|
| — | `20260217_add_aggregation_functions.sql` | Creates server-side aggregation functions (`get_active_orders_count`, `get_total_revenue`, etc.) |
| — | `20260217_add_performance_indexes.sql` | Adds indexes on orders and payments for query performance |
| — | `20260219_add_service_catalog.sql` | Seeds the service catalog config (item descriptions and photo URLs) |

### WK1 Migrations (000–011)

| # | File | What it does |
|---|------|-------------|
| 000 | `20260226_000_fix_status_constraint.sql` | Fixes status constraint |
| 001 | `20260226_001_alter_existing_tables.sql` | Alters existing tables |
| 002 | `20260226_002_create_new_tables.sql` | Creates new tables |
| 003 | `20260226_003_indexes.sql` | Adds indexes |
| 004 | `20260226_004_fix_aggregation_function.sql` | Fixes aggregation function |
| 005 | `20260226_005_status_validation.sql` | Status validation rules |
| 006 | `20260226_006_status_history_trigger.sql` | Status history trigger |
| 007 | `20260226_007_notification_queue_trigger.sql` | Notification queue trigger |
| 008 | `20260226_008_profile_stats_triggers.sql` | Profile stats triggers |
| 009 | `20260226_009_audit_new_tables.sql` | Audit new tables |
| 010 | `20260226_010_seed_email_templates.sql` | Seed email/notification templates |
| 011 | `20260226_011_verification.sql` | Verification script — if it finishes without errors, WK1 migrations are correct |

### WK2 Migrations (012–016)

| # | File | What it does | How to verify |
|---|------|-------------|---------------|
| 012 | `20260305_012_add_invoice_pdf_url.sql` | Adds `pdf_url` to invoices, `receipt_url` to payments | Check columns in table editor |
| 013 | `20260305_013_payment_notification_trigger.sql` | Payment notification trigger + templates | Check `notification_templates` for "Payment Confirmation" rows |
| 014 | `20260305_014_update_zones_fees.sql` | Updates zone fees, adds Syokimau + Other | Check `zones` table — Kitengela should be 300 |
| 015 | `20260305_015_pricing_function.sql` | Creates `calculate_order_pricing()` function | Test with SQL below |
| 016 | `20260305_016_unify_payments_ledger.sql` | Unifies payment schema, adds ledger event tables | Verify with SQL below |

**Verify migration 015** — run immediately after:

```sql
SELECT calculate_order_pricing(
  '[{"item_type":"carpet","length_inches":120,"width_inches":96,"quantity":1}]'::JSONB,
  'Kitengela',
  NULL
);
-- Expected: subtotal 4032, delivery_fee 300, vat_amount 693, total 5025
```

**Verify migration 016:**

```sql
-- Confirm unified columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'payments'
ORDER BY ordinal_position;
-- Should include both order_id AND invoice_id, plus all STK Push fields

-- Confirm event tables exist
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('payment_status_events', 'expense_status_events', 'invoice_status_events');

-- Confirm triggers are active
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_log_%';
-- Should show 6 triggers

-- Confirm the bad USING(true) policy is NOT present
SELECT policyname FROM pg_policies WHERE tablename = 'payments';
-- Should show: payments_admin_all, payments_customer_read, payments_driver_read, payments_driver_insert
-- Should NOT show: payments_service_all
```

### WK3 Migrations (020–024)

> **Prerequisite:** Migration 020 requires `pg_cron`, `pg_net`, and vault secrets to already be configured (Phase 3). If you skipped Phase 3, go back and do it now.

| # | File | What it does |
|---|------|-------------|
| 020 | `20260312_020_cron_all_jobs.sql` | Registers all cron jobs (replaces `MANUAL_post_deploy_pg_cron.sql`) |
| 021 | `20260312_021_fix_loyalty_points.sql` | Fixes loyalty points calculation |
| 022 | `20260312_022_seed_cron_templates.sql` | Seeds cron job templates |
| 023 | `20260312_023_promotion_usage_increment.sql` | Promotion usage increment |
| 024 | `20260312_024_fix_pricing_promo_enforcement.sql` | Server-side pricing + promo enforcement |

**Verify cron jobs registered:**

```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
-- Should see 5 jobs: birthday-discounts, payment-reminders,
-- process-notification-queue, sla-monitoring, warehouse-aging
```

### WK4 Migrations (025–026)

| # | File | What it does |
|---|------|-------------|
| 025 | `20260319_025_push_subscriptions.sql` | Push notification subscriptions table |
| 026 | `20260319_026_report_functions.sql` | Report aggregation functions |

> **Do NOT run** `MANUAL_post_deploy_pg_cron.sql` — it is superseded by migration 020.

---

## Phase 5: Set Edge Function Secrets

Run from your terminal:

```bash
supabase secrets set \
  AFRICASTALKING_API_KEY=your-at-api-key \
  AFRICASTALKING_USERNAME=sandbox \
  AFRICASTALKING_SENDER_ID=EXPRESSWASH \
  RESEND_API_KEY=re_your-resend-key \
  BANK_API_BASE_URL=https://api.creditbank.co.ke \
  BANK_CONSUMER_KEY=your-credit-bank-consumer-key \
  BANK_CONSUMER_SECRET=your-credit-bank-consumer-secret \
  CALLBACK_BASE_URL=https://your-project-ref.supabase.co/functions/v1 \
  BANK_CALLBACK_IPS=comma-separated-whitelist-ips-from-credit-bank
```

You can also verify these are set in the Dashboard under **Edge Functions → Secrets**.

The following are auto-set by Supabase (no action needed):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

> **Note on M-Pesa callback:** Configure the callback URL in your Credit Bank dashboard as:
> `https://<your-project-ref>.supabase.co/functions/v1/payment-callback`

---

## Phase 6: Deploy Edge Functions

Deploy all four Edge Functions:

```bash
supabase functions deploy send-notification
supabase functions deploy generate-pdf
supabase functions deploy stk-push
supabase functions deploy payment-callback
```

> **Alternative (no CLI):** Go to **Dashboard → Edge Functions**, create each function manually, and paste the contents of the corresponding `supabase/functions/<name>/index.ts`. Also upload shared files from `supabase/functions/_shared/` (`logger.ts`, `rateLimiter.ts`).

---

## Phase 7: Build Verification

Confirm everything compiles before testing:

```bash
npm run build   # Should complete with 0 errors
npm run lint    # Pre-existing warnings only
npm test        # All tests should pass
npm run dev     # Start the dev server
```

---

## Phase 8: Smoke Tests

### 8.1 — Test: Notification Edge Function (manual trigger)

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notification \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Expected response (empty queue):

```json
{ "processed": 0, "failed": 0, "message": "Queue empty" }
```

### 8.2 — Test: Full Notification Pipeline (end-to-end)

**Step 1:** Find or create a test order with `status = 1` (Pending) and a real customer phone/email.

**Step 2:** Change the order status from 1 → 2 (Confirmed):

```sql
UPDATE orders SET status = 2 WHERE tracking_code = 'YOUR_TEST_ORDER';
```

**Step 3:** Verify a notification was queued:

```sql
SELECT id, channel, recipient_contact, body, status, template_name
FROM notification_history
WHERE status = 'pending'
ORDER BY sent_at DESC
LIMIT 5;
-- Should see a row with status = 'pending', template_name = 'Order Confirmation'
-- Body should have real values (no {{variable}} literals)
```

**Step 4:** Trigger the Edge Function:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notification \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Expected: `{ "processed": 1, "failed": 0, "total": 1 }`

**Step 5:** Verify delivery:

```sql
SELECT id, status, body, failure_reason
FROM notification_history
ORDER BY sent_at DESC
LIMIT 5;
-- status should now be 'sent'
```

Check your phone for the SMS / inbox for the email.

### 8.3 — Test: Status Validation

```sql
-- Should SUCCEED (valid: 1 → 2)
UPDATE orders SET status = 2 WHERE tracking_code = 'YOUR_TEST_ORDER';

-- Should FAIL with "Invalid status transition: 1 → 12"
UPDATE orders SET status = 12 WHERE tracking_code = 'ANOTHER_ORDER_WITH_STATUS_1';

-- Should SUCCEED (valid: 2 → 13, cancellation)
UPDATE orders SET status = 13 WHERE tracking_code = 'YOUR_TEST_ORDER';
```

### 8.4 — Test: Profile Stats

```sql
-- Check a customer's stats before
SELECT total_orders, total_spent FROM profiles WHERE id = 'CUSTOMER_UUID';

-- Move an order through to delivered (status 12)
-- (step through each valid transition)

-- Check stats after — total_orders and total_spent should have incremented
SELECT total_orders, total_spent FROM profiles WHERE id = 'CUSTOMER_UUID';
```

### 8.5 — Test: Ledger Events

```sql
-- Insert a payment → event should auto-log
INSERT INTO payments (order_id, amount, method, status)
VALUES ('<any-valid-order-id>', 100, 'cash', 'pending');

-- Check event was created
SELECT * FROM payment_status_events ORDER BY created_at DESC LIMIT 1;
-- Should show: from_status=NULL, to_status='pending', trigger_source='initial_insert'

-- Update that payment's status → event should auto-log
UPDATE payments SET status = 'completed'
WHERE id = '<the-id-from-above>';

-- Check both events exist
SELECT * FROM payment_status_events
WHERE payment_id = '<the-id-from-above>'
ORDER BY created_at;
-- Should show 2 rows: NULL→pending, then pending→completed

-- Clean up test data
DELETE FROM payments WHERE id = '<the-id-from-above>';
```

### 8.6 — Test: Pricing Function (server-side)

```sql
SELECT calculate_order_pricing(
  '[{"item_type":"carpet","length_inches":120,"width_inches":96,"quantity":1}]'::JSONB,
  'Kitengela',
  NULL
);
-- Expected: subtotal 4032, delivery_fee 300, vat_amount 693, total 5025
```

---

## Phase 9: Full Acceptance Tests (in the browser)

Start the dev server (`npm run dev`) and test each flow.

### 9.1 — Automated Notifications (pg_cron)

1. Change an order's status to 2 (Confirmed)
2. **Do NOT** manually trigger the Edge Function
3. Within 60 seconds, `pg_cron` should pick it up automatically
4. You should receive the SMS/email without manual intervention

### 9.2 — Invoice PDF Download

1. Log in as a customer with at least one invoice
2. Go to Invoices page
3. Click **Download** on any invoice → PDF opens in a new tab with correct branding, line items, VAT, total
4. Click again → should be faster (cached storage path)
5. Log in as admin → Billing & Financials → verify PDF icon in the table works

### 9.3 — Server-Side Pricing (customer checkout)

1. Log in as customer → **Request Pickup**
2. Select zone: Kitengela, add a carpet (120 x 96 inches)
3. Verify quote: subtotal 4,032 + delivery 300 + VAT 693 = total 5,025
4. Submit the order
5. Check `orders` table in Supabase — verify total matches the server calculation

### 9.4 — Reviews

1. As customer, go to **My Reviews**
2. On a delivered order (status 12), click **Write Review**
3. Submit a 4-star review with text
4. Check `reviews` table — row exists with `status = 'pending'`
5. As admin, go to **Reviews & Moderation** → see the pending review
6. Approve it → verify status changes to `approved`

### 9.5 — Expenses

1. As admin, go to **Profit & Expenses → Add Expense**
2. Fill in: category = `fuel`, description = "Delivery van fuel", amount = 3500, method = `cash`
3. Submit → row appears in table with status `pending`
4. Approve → verify `approved_by` and `approved_at` are set in DB
5. Check Expense Breakdown chart updates
6. **Valid categories only:** fuel, supplies, salary, rent, utilities, marketing, maintenance, other

### 9.6 — Payment Notification

1. As admin/driver, record a payment via the Cash Collection page
2. Check `notification_history` — new rows with `template_name = 'Payment Confirmation'` and `status = 'pending'`
3. Wait for pg_cron (or trigger manually) to process the queue

### 9.7 — Driver Cash Collection

1. Log in as driver → **Cash Collection**
2. Verify it shows real payment records
3. KPI cards reflect actual collected/remitted amounts

### 9.8 — Zone Management (Admin)

1. Go to `/admin/pricing` → Zones tab
2. Verify existing zones load
3. Create a zone (e.g. "Test Zone", same_day policy, KES 400, cutoff 14:00)
4. Edit the zone — change fee, toggle policy
5. Toggle active/inactive
6. As customer in another tab — verify the new zone appears in the Request Pickup dropdown immediately

### 9.9 — Promotion Management (Admin)

1. Go to `/admin/promotions`
2. Create a promo: "TEST20", percentage, 20% off, max discount KES 500, min order KES 1,000, valid today–tomorrow
3. Verify code appears in table with copy button
4. Toggle active/inactive; edit the promotion

### 9.10 — Promo Code at Checkout (Customer)

1. Go to `/customer/request-pickup`, add items, select a zone
2. Enter the promo code → green checkmark
3. Try an expired/invalid code → red error
4. Try a code with `min_order_amount` higher than subtotal → rejection message
5. Submit order with valid promo → order creates successfully
6. Try the same code again (if `usage_per_customer = 1`) → "already used"

### 9.11 — Server-Side Promo Enforcement

1. Create a promotion: 20% off, max discount KES 500
2. Place an order worth KES 50,000 with that code
3. Verify discount is capped at KES 500 (not KES 10,000)
4. Check `promotion_usage` table — `discount_applied` should be 500

### 9.12 — Loyalty Points

1. Complete an order (set status to 12 / delivered)
2. Check `loyalty_accounts` — points should be `FLOOR(order.total / 100)`, not flat 50
3. Check `loyalty_transactions` — new earn row exists

### 9.13 — Payment History (Customer)

1. Go to `/customer/payments`
2. Payments show invoice number OR order ID in the "Invoice #" column (not blank)
3. Reference column shows reference / M-Pesa receipt (not blank)

### 9.14 — STK Push (if you have M-Pesa sandbox credentials)

1. Initiate an STK Push payment from the UI
2. Check `payments` table — should have `order_id`, `merchant_request_id`, `checkout_request_id`
3. Check `payment_status_events` — initial `pending` event
4. After callback, check events table for `pending → completed` (or `pending → failed`) transition

---

## Phase 10: Production Deployment

### 10.1 — Set Vercel environment variables

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export VERCEL_TOKEN="your-vercel-token"
node set-env-vercel.cjs
```

Confirm it sets the Vercel env vars successfully. Also add `VITE_SENTRY_DSN` to your Vercel project env vars.

### 10.2 — Switch Africa's Talking from sandbox to production

Once your sender ID is approved:

```bash
supabase secrets set \
  AFRICASTALKING_USERNAME=your-live-username \
  AFRICASTALKING_API_KEY=your-live-api-key
```

---

## Quick Reference: Where Secrets Go

| Secret / Config | Where to set it |
|----------------|----------------|
| `VITE_SUPABASE_URL` | `.env` (local) + Vercel env vars (prod) |
| `VITE_SUPABASE_ANON_KEY` | `.env` (local) + Vercel env vars (prod) |
| `VITE_SENTRY_DSN` | `.env` (local) + Vercel env vars (prod) |
| `VITE_GOOGLE_MAPS_API_KEY` | `.env` (local) + Vercel env vars (prod) |
| `VITE_VAPID_PUBLIC_KEY` | `.env` (local) + Vercel env vars (prod) |
| `AFRICASTALKING_API_KEY` | `supabase secrets set` |
| `AFRICASTALKING_USERNAME` | `supabase secrets set` |
| `AFRICASTALKING_SENDER_ID` | `supabase secrets set` |
| `RESEND_API_KEY` | `supabase secrets set` |
| `BANK_CONSUMER_KEY` | `supabase secrets set` |
| `BANK_CONSUMER_SECRET` | `supabase secrets set` |
| `BANK_API_BASE_URL` | `supabase secrets set` |
| `CALLBACK_BASE_URL` | `supabase secrets set` |
| `BANK_CALLBACK_IPS` | `supabase secrets set` |
| Google OAuth Client ID + Secret | Supabase Dashboard → Auth → Providers → Google |
| Supabase URL + service role key | Vault secrets (SQL) — used by pg_cron jobs |

---

## Things You Do NOT Need to Do

- **Do NOT run** `MANUAL_post_deploy_pg_cron.sql` — fully replaced by migration 020
- **No extra env vars** for `generate-pdf` — `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-set by Supabase
- **paymentService.ts** has a known issue writing wrong columns — this is pre-existing tech debt, does not affect current flows (WK2+ uses `invoiceService.ts` which is correct)
- **docs/WK3.md** is an untracked reference doc with some outdated column names — the committed migrations are authoritative
