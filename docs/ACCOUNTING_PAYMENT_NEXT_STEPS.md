# Accounting Core And PesaPal Next Steps

This branch prepares the accounting/payment foundation for the next Zoho-like finance phase and switches the active online payment architecture from a bank-specific integration to a provider-backed PesaPal flow.

## Migrations To Run

Run these in order on Supabase before deploying the updated Edge Functions:

For the existing live database, migrations through `067` were already applied before the local-first `068` hardening pass. Do not replay the local baseline or renamed historical migration chain on live. Apply only the next unapplied migration SQL for the target database's migration history.

Current local migration filenames use Supabase CLI timestamp versions so `supabase db reset --local` can replay the full project from scratch.

1. `supabase/migrations/20260622000001_053_accounting_payment_safety.sql`
   - Adds atomic invoice payment recording.
   - Updates payment callback completion so paid invoices receive correct `paid_amount` and `balance`.
2. `supabase/migrations/20260622000002_054_restore_zone_delivery_fees.sql`
   - Restores positive delivery fees for existing zones.
   - Adds a check constraint preventing zero/negative zone delivery fees.
3. `supabase/migrations/20260622000003_055_payment_provider_abstraction.sql`
   - Adds `payments.provider`, `provider_payment_id`, `provider_reference`, `provider_status`, and `provider_metadata`.
   - Replaces `process_payment_callback(...)` with provider-aware, row-locked, idempotent callback processing.
4. `supabase/migrations/20260623000001_056_accounting_core_schema.sql`
   - Adds canonical contacts, tax rates, chart of accounts, accounting items, invoice lines, payment allocations, bills/payables, payment-made allocations, credit notes, journal entries, and journal lines.
   - Backfills contacts from customer profiles and invoice lines from existing invoice items where possible.
   - Adds `post_journal_entry(...)` and `reverse_journal_entry(...)` with enforced balanced debits/credits.
5. `supabase/migrations/20260623000002_057_accounting_report_functions.sql`
   - Adds ledger-backed P&L, balance sheet, VAT summary, receivables aging, and payables aging RPCs.
   - These reports are additive and do not replace the older operational dashboard RPCs yet.
6. `supabase/migrations/20260623000003_058_notification_outbox_replay.sql`
   - Adds a durable notification outbox, delivery-attempt history, enqueue RPC, attempt marker RPC, and replay RPC.
   - This is the foundation for WhatsApp/email/SMS delivery workers without sending inside finance request handlers.
7. `supabase/migrations/20260623000004_059_payment_payer_phone_audit.sql`
   - Stores the provider-observed payer phone separately from the phone entered in our checkout UI.
   - Flags phone mismatches as audit metadata without rejecting legitimate third-party payments.
8. `supabase/migrations/20260623000005_060_operational_accounting_workflows.sql`
   - Adds posted journal references to invoices, payments, and expenses.
   - Adds RPCs for invoice posting, payment-received posting, supplier bill creation, bill posting, bill payment recording, payment-made posting, credit-note creation/posting, and expense posting.
   - Replaces `record_invoice_payment(...)` so manual invoice payments create payment allocations and ledger entries in one transaction.
   - Replaces `complete_payment_transaction(...)` so completed online payments allocate to linked invoices and post ledger entries when invoices exist.
9. `supabase/migrations/20260623000006_061_cash_flow_and_outbox_admin.sql`
   - Adds a ledger-backed cash-flow RPC for admin reporting.
   - Keeps notification outbox replay available from the admin UI through the existing replay RPC.
10. `supabase/migrations/20260624000001_062_non_blocking_payment_notifications.sql`
    - Replaces the legacy payment notification trigger so notification/template/preference failures cannot roll back financial payment records.
    - Keeps payment confirmation notification failures visible as Postgres warnings while preserving the payment, allocation, and ledger transaction.
11. `supabase/migrations/20260624000002_063_invoice_payment_credit_balance.sql`
    - Replaces manual invoice payment recording so it subtracts from the current open balance, preserving previously-applied credit notes.
    - Backfills affected credited invoices to `total - paid_amount - applied_credit_notes`.
12. `supabase/migrations/20260624000003_064_invoice_editor_allocation_refunds.sql`
    - Adds transaction-safe invoice creation/update RPCs backed by canonical `invoice_lines`.
    - Adds `payments.unapplied_amount`, multi-invoice allocation RPC support, and `customer_refunds`.
    - Adds refund posting to the ledger without rewriting original payment history.
13. `supabase/migrations/20260624000004_065_refund_cumulative_guard.sql`
    - Replaces `record_customer_refund(...)` so cumulative refunds cannot exceed the original payment amount or invoice paid amount.
    - Keeps the refund ledger posting balanced while preserving the original payment history.
14. `supabase/migrations/20260624000005_066_invoice_ledger_entry_date.sql`
    - Replaces `post_invoice_to_ledger(...)` so invoice ledger entries use the invoice issue date instead of payment due date.
    - Repairs existing posted invoice journal entries that were incorrectly dated after their invoice issue/creation date.
15. `supabase/migrations/20260624000006_067_balance_sheet_current_earnings.sql`
    - Replaces `get_ledger_balance_sheet(...)` so current income/expense earnings are shown as an equity component until books are closed to retained earnings.
    - Fixes false out-of-balance report badges when the ledger is balanced but current earnings have not been closed.
16. `supabase/migrations/20260625000001_068_accounting_permission_hardening.sql`
    - Removes PostgreSQL's default public execute surface from accounting security-definer RPCs.
    - Keeps admin UI workflows callable only through authenticated RPCs with admin checks.
    - Restricts provider callback and notification-attempt worker RPCs to `service_role`.
    - Removes direct authenticated writes to core accounting tables except contact upserts; bills, allocations, refunds, credit notes, ledger entries, and outbox changes go through RPCs.
17. `supabase/migrations/20260625000002_069_customer_credit_allocation_workflow.sql`
    - Adds Customer Credits as a liability account for unapplied customer payments.
    - Adds admin RPCs for customer credit balances and payment allocation options.
    - Keeps later credit application ledger-safe with adjustment journal entries rather than rewriting posted payment journals.
18. `supabase/migrations/20260626000001_070_notification_outbox_worker_claim.sql`
    - Adds a service-role-only claim RPC for notification workers.
    - Atomically claims due pending/failed outbox rows and stale processing rows, using `FOR UPDATE SKIP LOCKED`.
19. `supabase/migrations/20260626000002_071_schedule_notification_outbox_worker.sql`
    - Adds the `process-notification-outbox` cron job.
    - Calls `notification-worker` every minute through `pg_net` with the `service_role_key` vault secret.

## Supabase Secrets

Do not commit provider credentials. Set them as Supabase function secrets.

```bash
supabase secrets set \
  PAYMENT_PROVIDER=pesapal \
  PESAPAL_ENVIRONMENT=live \
  PESAPAL_CONSUMER_KEY="<set-from-pesapal>" \
  PESAPAL_CONSUMER_SECRET="<set-from-pesapal>" \
  PESAPAL_IPN_ID="<registered-ipn-id>" \
  SITE_URL="https://your-production-site" \
  PESAPAL_CANCELLATION_URL="https://your-production-site/portal/orders" \
  RESEND_API_KEY="<set-for-email-delivery>" \
  WHATSAPP_WEBHOOK_URL="<optional-whatsapp-provider-webhook>" \
  WHATSAPP_WEBHOOK_TOKEN="<optional-whatsapp-provider-token>" \
  AFRICASTALKING_API_KEY="<set-for-sms-or-whatsapp-fallback>" \
  AFRICASTALKING_USERNAME="<set-for-sms-or-whatsapp-fallback>" \
  AFRICASTALKING_SENDER_ID="<optional-sender-id>"
```

For sandbox testing, use:

```bash
supabase secrets set \
  PAYMENT_PROVIDER=pesapal \
  PESAPAL_ENVIRONMENT=sandbox \
  PESAPAL_CONSUMER_KEY="<sandbox-key>" \
  PESAPAL_CONSUMER_SECRET="<sandbox-secret>" \
  PESAPAL_IPN_ID="<sandbox-ipn-id>" \
  SITE_URL="https://your-test-site" \
  ALLOW_TEST_PAYMENT_AMOUNT=true
```

`ALLOW_TEST_PAYMENT_AMOUNT=true` should only be used for sandbox/dev testing. Production payments use the server-side order total rather than trusting the frontend amount.

## PesaPal Setup

PesaPal API 3.0 requires:

1. Generate an auth token using the consumer key/secret.
2. Register a public IPN URL and store the returned `ipn_id` as `PESAPAL_IPN_ID`.
3. Submit orders with `notification_id`.
4. On callback/IPN, call `GetTransactionStatus` because PesaPal does not include the final payment status in the callback/IPN payload.

Register this IPN URL:

```text
https://<supabase-project-ref>.supabase.co/functions/v1/payment-callback
```

Use `POST` for the IPN registration method.

References:

- PesaPal authentication: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/authentication
- PesaPal IPN registration: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/registeripnurl
- PesaPal SubmitOrderRequest: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest
- PesaPal GetTransactionStatus: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus

## Edge Functions To Deploy

Deploy after migrations and secrets are in place:

```bash
supabase functions deploy stk-push
supabase functions deploy payment-callback --no-verify-jwt
supabase functions deploy generate-pdf
supabase functions deploy notification-worker
```

`stk-push` remains the public function name for frontend compatibility, but internally it is now a provider-backed payment start endpoint.
`notification-worker` must be called with the service-role bearer token. Apply migration `071` only after migration `070` is applied and the function is deployed.

## Architecture Applied

The payment flow follows the two transcript constraints:

- Payment intent is written before the provider call, so a retry/repeat click does not create a duplicate active payment for the same order.
- Provider callbacks are processed through one database RPC with row locking and idempotency.
- `payments.status` remains the current projection; `payment_status_events` records status changes.
- Provider-specific identifiers and latest provider state live in provider fields, so switching providers later is adapter work rather than schema churn.
- Notifications are queued only after the payment state is stored. The new `notification_outbox` tables provide the long-term delivery/retry/replay foundation; existing `notification_history` remains for current app notifications until the worker migration is wired.
- Accounting reports now read canonical facts: invoice/payment/bill source tables for aging and VAT, and `ledger_journal_lines` for ledger statements.
- Posted ledger entries are immutable in practice: corrections should use `reverse_journal_entry(...)`, credit notes, or adjustment entries rather than destructive edits.

## Post-Deploy Test Checklist

1. Apply the next unapplied accounting migration through `20260625000001_068_accounting_permission_hardening.sql`, without replaying the local baseline on an existing live database.
2. Set Supabase secrets.
3. Register the PesaPal IPN URL and set `PESAPAL_IPN_ID`.
4. Deploy the three Edge Functions.
5. Start a sandbox payment from an order.
6. Confirm the payment row has:
   - `provider = 'pesapal'`
   - `provider_payment_id` set to PesaPal `order_tracking_id`
   - `provider_reference` set to the merchant reference
   - `provider_status = 'submitted'` before payment completion
7. Complete the payment and confirm:
   - PesaPal IPN calls `payment-callback`
   - `payments.status` becomes `completed`
   - `orders.payment_status` becomes `paid`
   - linked invoice `paid_amount` and `balance` are updated
   - linked invoice has `posted_journal_entry_id` when an invoice exists
   - completed payment has `posted_journal_entry_id` when it allocated to an invoice
   - `payment_allocations` contains the invoice/payment allocation
   - `notification_history` receives pending notification rows
8. In Admin → Accounts:
   - Create a supplier contact.
   - Create a supplier bill with an expense account and optional input VAT.
   - Confirm the bill is listed under Payables & Bills and has a posted ledger entry.
   - Record a bill payment and confirm the bill balance/status update.
   - Open Reports and confirm Cash Flow renders from ledger cash/bank/M-Pesa entries.
   - Open Outbox and confirm failed/dead-letter deliveries can be replayed.
9. In Admin → Invoices:
   - Open an unpaid invoice and use `Post` to post it to the ledger.
   - Record a manual invoice payment and confirm it updates balance, allocation, and ledger.
   - If payment recording returns `invalid input value for enum payment_method: "M-Pesa"`, migration `20260624_062_non_blocking_payment_notifications.sql` is not active on that database.
   - Create a credit note against an open invoice balance and confirm the balance reduces.

## What This Branch Now Covers

- Provider-backed PesaPal payment start/callback flow.
- Canonical payment provider columns and idempotent callback processing.
- Admin invoice payment recording through a transaction-safe RPC.
- Canonical accounting schema for contacts, invoice lines, payment allocations, bills, bill lines, payments made, credit notes, chart of accounts, tax rates, and ledger journal entries.
- Balanced journal posting and reversal RPCs.
- Typed frontend service boundaries under `src/services/accounting`.
- Ledger/VAT/aging report RPCs and typed report wrappers.
- Notification outbox/retry/replay schema and typed enqueue/replay wrappers.
- Operational accounting RPCs for invoice posting, payment allocations, supplier bills, bill payments, credit notes, and expense posting.
- Ledger cash-flow reporting.
- Admin UI for contacts/suppliers, bills/payables, bill payments, invoice ledger posting, credit notes, cash flow, and notification outbox replay.
- Admin invoice creation/editing backed by canonical invoice lines.
- Multi-line supplier bill entry.
- Customer refund recording from payment trails with ledger posting.

## Remaining Accounting Work

This branch still does not finish the full Zoho-like accounting product. The foundation exists, but the next implementation passes should wire the user-facing workflows:

- Advanced payment allocation UI for one payment across multiple invoices.
- Customer credit balance handling beyond refund recording.
- More complete posting automation for all existing legacy expenses and historical records.
- Live provider verification for WhatsApp PDF/link delivery using the notification outbox.

Because payment credentials were shared in chat, consider rotating them before production if this conversation or logs are accessible beyond the implementation team.
