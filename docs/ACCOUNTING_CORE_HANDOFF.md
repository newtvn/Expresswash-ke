# Accounting Core Handoff

Last updated: 2026-06-25
Branch: `accounting-core-safety`  
Remote: `origin/accounting-core-safety`  
Latest pushed commit before permission hardening: `d5df9c9 Fix meta injection path resolution`

## Current Status

This branch was merged to `main` via PR #55 and the Edge Functions were redeployed for the current accounting/PesaPal batch.

Additional local hardening is implemented in migration `068`; it has not been applied live yet.

Verified live after migrations through `067`:

- PesaPal-backed payment flow is wired through the existing `stk-push` function name for frontend compatibility.
- Payment callback processing is provider-aware, row-locked, and idempotent.
- Payment Trail shows provider references, provider status, receipt details, intent phone, provider payer phone, and immutable status events.
- Admin can allocate received payments to invoices.
- Admin can record customer refunds from the payment trail.
- Admin can create supplier contacts, create supplier bills, record bill payments, post invoices, record manual invoice payments, and create credit notes.
- Invoice journal entries now post on invoice issue/created date, not due date.
- Balance Sheet now includes Current Earnings under Equity and shows `Balanced`.
- Chrome verified Admin Accounts and Admin Invoices on desktop and mobile.
- Supabase Edge Functions redeployed after merge:
  - `stk-push`
  - `payment-callback --no-verify-jwt`
  - `generate-pdf`
- `main` CI initially failed in `scripts/inject-meta.mjs` under Node 18 after Vite built successfully; commit `d5df9c9` fixed path resolution and the rerun passed.

Final verification commands passed:

```bash
npm run build
npm run lint
npm run test -- src/services/accounting/domain.test.ts
npm run test
```

`npm run lint` has 9 existing warnings only, no errors.

## Uncommitted Local Files

These were intentionally not committed because they are unrelated/generated:

```text
supabase/.temp/cli-latest
src/components/landing/FAQ (1).tsx
```

Do not include them in this accounting merge unless they are separately reviewed.

## Architecture Direction

The agreed architecture is a lightweight Zoho-like accounting system with two distinct layers:

```text
Operational finance layer:
Contacts, quotes, orders, invoices, invoice lines, payments, allocations,
receipts, expenses, supplier bills, bill payments, credit notes, refunds.

Accounting ledger layer:
Chart of accounts, journal entries, journal lines, VAT postings,
current earnings, reversals, and report RPCs.
```

The operational layer is what admins use. The ledger layer is what makes P&L, Balance Sheet, VAT, cash flow, receivables, and payables trustworthy.

Do not build future reports directly by summing scattered UI fields. Reports should come from canonical operational tables or `ledger_journal_entries` / `ledger_journal_lines`.

## Core Accounting Rules

- Draft operational records may be edited.
- Posted financial records should not be destructively edited.
- Corrections should use:
  - reversals,
  - credit notes,
  - refunds,
  - adjustment journal entries.
- Every posted journal entry must balance: total debits equal total credits.
- Payments are not receipts. A payment is the source of financial truth; a receipt is proof generated from a payment.
- One payment can pay multiple invoices, and one invoice can receive multiple payments.
- Webhook/provider state should be appended to event history, not only overwritten on one status row.
- External delivery should use outbox/retry/replay, not send directly inside the request path.

## Payment Architecture

The active provider is PesaPal, but the code is provider-oriented so future provider swaps should not require a schema overhaul.

Important files:

```text
supabase/functions/_shared/paymentProviders.ts
supabase/functions/stk-push/index.ts
supabase/functions/payment-callback/index.ts
src/services/paymentService.ts
src/hooks/usePayment.ts
src/components/payment/PaymentModal.tsx
src/components/payment/PaymentMethodSelector.tsx
```

Provider fields added to `payments`:

```text
provider
provider_payment_id
provider_reference
provider_status
provider_metadata
provider_payer_phone
intent_phone
payer_phone_mismatch
```

Important behavior:

- `stk-push` remains the public frontend function name.
- Internally, it submits PesaPal orders.
- `payment-callback` must remain deployed with `--no-verify-jwt`.
- Callback/IPN handling must query PesaPal transaction status before marking payment complete.
- Duplicate/replayed callbacks should be safe.
- Status changes are recorded in `payment_status_events`.

## Migrations Applied

These migrations were part of this branch. Migrations `053` through `070` have been applied live; `071` is the next scheduler migration:

```text
053 accounting payment safety
054 restore zone delivery fees
055 payment provider abstraction
056 accounting core schema
057 accounting report functions
058 notification outbox replay
059 payment payer phone audit
060 operational accounting workflows
061 cash flow and outbox admin
062 non-blocking payment notifications
063 invoice payment credit balance
064 invoice editor allocation refunds
065 refund cumulative guard
066 invoice ledger entry date
067 balance sheet current earnings
068 accounting permission hardening
069 customer credit allocation workflow
070 notification outbox worker claim
071 schedule notification outbox worker (verified locally; apply after notification-worker deploy)
```

Local migration filenames have been normalized to Supabase CLI-compatible timestamp versions so a fresh local reset can replay the full chain. For live, apply only the next unapplied migration SQL, using the live migration history as the source of truth.

Runbook details are in:

```text
docs/ACCOUNTING_PAYMENT_NEXT_STEPS.md
```

## Supabase Edge Functions

Deploy/redeploy these after merge if production needs the latest branch state:

```bash
supabase functions deploy stk-push
supabase functions deploy payment-callback --no-verify-jwt
supabase functions deploy generate-pdf
supabase functions deploy notification-worker
```

Required Supabase secrets:

```text
PAYMENT_PROVIDER=pesapal
PESAPAL_ENVIRONMENT=live
PESAPAL_CONSUMER_KEY
PESAPAL_CONSUMER_SECRET
PESAPAL_IPN_ID
SITE_URL
PESAPAL_CANCELLATION_URL
WHATSAPP_WEBHOOK_URL (optional; otherwise WhatsApp outbox falls back to SMS if configured)
WHATSAPP_WEBHOOK_TOKEN (optional)
RESEND_API_KEY (for email outbox delivery)
AFRICASTALKING_API_KEY / AFRICASTALKING_USERNAME / AFRICASTALKING_SENDER_ID (for SMS fallback)
```

Do not commit real provider secrets. Rotate credentials before production if the chat/logs are visible beyond the implementation team.

## UI Surfaces Wired

Admin:

```text
/admin/accounts
/admin/invoices
```

Key admin workflows now available:

- Contacts/suppliers.
- Supplier bill creation with multiple lines.
- Bill payment recording.
- Payment received trail view.
- Manual payment allocation.
- Customer refund recording.
- Credit note creation.
- Invoice creation/edit using canonical invoice lines.
- Invoice posting to ledger.
- Ledger reports:
  - P&L,
  - Balance Sheet,
  - VAT Summary,
  - Cash Flow,
  - Aging summaries,
  - Chart of Accounts,
  - Journal Entries.
- Notification outbox visibility/replay foundation.
- Notification worker foundation for service-role outbox processing and delivery attempts.

## Live Verification Already Done

Chrome DevTools verification:

- Admin login works with:

```text
ngethenan768+admin@gmail.com
```

- `ngethenan768@gmail.com` was rejected on the login screen at the end of testing, while `ngethenan768+admin@gmail.com` worked.
- Accounts Reports showed:

```text
Assets: KES 446
Liabilities: KES 89.1
Equity: KES 356.9
Badge: Balanced
Equity line: 3999 · Current Earnings · KES 356.9
```

- Invoice journal entries for QA invoices show `24/06/2026`.
- Payment allocation completed from Payment Trail.
- Refund `RF-20260624-85AA7F` with reference `QA-REFUND-064` was recorded and posted.

Review artifact:

```text
reviews/accounting-core-safety-review-5.md
```

`reviews/` is local/gitignored.

## Recommended Next Plan

### 1. Merge and deploy this branch

Status: completed for the `067` batch. PR #55 was merged to `main`; Edge Functions were deployed. Live smoke is intentionally deferred until local validation of the next phase is complete.

Post-deploy smoke:

- Load landing page.
- Login as admin.
- Open Admin Accounts → Reports and confirm Balance Sheet is `Balanced`.
- Open Admin Accounts → Payments Received and open a recent Payment Trail.
- Open Admin Invoices and confirm posted invoice badges/actions render.
- Run one small real/sandbox PesaPal payment if safe to do so.

### 2. Harden accounting permissions

Audit admin-only RPCs and RLS policies around:

```text
contacts
bills
payments_made
payment_allocations
customer_refunds
credit_notes
ledger_journal_entries
ledger_journal_lines
notification_outbox
```

Confirm non-admin roles cannot mutate accounting records directly.

Current local implementation: `supabase/migrations/20260625000001_068_accounting_permission_hardening.sql`.

The migration:

- revokes default `PUBLIC`/`anon` execute from accounting security-definer RPCs,
- keeps admin UI RPCs available to authenticated users while relying on their admin checks,
- makes payment-completion/provider-callback and notification-attempt RPCs service-role only,
- removes direct authenticated writes to core accounting tables except `contacts`, which the current admin UI upserts directly,
- leaves reads protected by existing RLS policies.

Local verification completed after the migration-chain repair:

- `supabase db reset --local` replays from the new baseline through `068`.
- `supabase db lint --local` passes with only the existing `v_tier` and `v_default_fees` warnings.
- Chrome DevTools local smoke passed against `http://127.0.0.1:8080`: admin login, Admin Accounts reports, Balance Sheet `Balanced`, Payables & Bills, Payments Received, Credits & Refunds, Contacts, Outbox, and Admin Invoices all rendered against local Supabase.
- Permission probes confirmed anon has zero direct grants on accounting/outbox tables; authenticated has read grants plus contact upsert only; provider callback/payment-completion/notification-attempt RPCs are service-role only.

### 3. Split large admin UI files

`src/pages/admin/Accounts.tsx` and `src/pages/admin/AdminInvoices.tsx` are now large. Split after merge into focused components:

```text
AccountsReportsPanel
PaymentsReceivedPanel
PaymentTrailDialog
RefundDialog
SupplierBillsPanel
BillDialog
ContactsPanel
OutboxPanel
InvoiceEditorDialog
InvoicePaymentDialog
CreditNoteDialog
```

Do not change behavior during this refactor without tests.

### 4. Complete Zoho-like workflows

Next product work:

- Better multi-invoice payment allocation UX.
- Customer credits/refunds lifecycle beyond simple refund recording.
- Credit-note/reversal history per invoice.
- Ledger report polish for:
  - P&L,
  - Balance Sheet,
  - VAT,
  - Cash Flow.
- More complete invoice/bill line editor UX.
- Supplier/customer statements.
- Period close workflow to move current earnings into retained earnings.

### 5. WhatsApp/PDF delivery via outbox

Do not send WhatsApp directly inside invoice actions.

Correct flow:

```text
Create/post invoice
Generate or reference PDF
Write notification_outbox row
Worker sends WhatsApp/PDF/link
Record delivery attempts
Retry temporary failures
Dead-letter permanent failures
Allow admin replay
```

Delivery history should include:

```text
invoice_id
channel
recipient_phone
provider_message_id
status
sent_at
delivered_at
read_at
failed_reason
```

### 6. Add more tests around accounting RPC behavior

Good next tests:

- Payment allocation cannot over-allocate.
- Refund cannot cumulatively exceed payment amount.
- Refund cannot exceed invoice paid amount.
- Invoice posting is idempotent.
- Payment callback replay is idempotent.
- Balance Sheet includes current earnings before close.
- Credit note reduces invoice balance without corrupting paid amount.

## Merge Readiness Summary

Ready for this batch:

- Branch is pushed.
- Migrations through `067` applied and verified.
- Local migration chain through `068` resets cleanly.
- Tests passed locally.
- Chrome verification passed locally and previously live through `067`.
- PR review completed locally.
- No known critical or important blockers remain.
