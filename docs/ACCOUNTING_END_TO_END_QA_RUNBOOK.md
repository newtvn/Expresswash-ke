# Expresswash Accounting End-to-End QA and Fix Runbook

Last updated: 2026-09-09
Primary application: Expresswash
Accounting scopes: Expresswash, Goalhub, and consolidated
Production timezone: Africa/Nairobi
Currency: KES

## 1. Purpose

This is the release-gate runbook for the Expresswash accounting area and every
screen or workflow that feeds it. It is intentionally stricter than a normal UI
smoke test because accounting records are audited and must remain traceable,
balanced, correctly scoped, and reproducible.

The QA agent owns the result, not merely the execution of a checklist. If a test
fails, the agent must stop, reproduce the failure, identify and fix the root
cause, add or improve regression coverage, and repeat the affected checks. The
agent may proceed only after the fix is independently verified. A failed check
must never be relabelled as a known issue merely to finish the run.

This runbook covers:

- Public landing, authentication, customer portal, and admin navigation.
- Accounts, Invoices, Receipts, Billing, and Profit & Expense from list screens
  through detail screens and mutations.
- All ten tabs in **Admin > Accounts**.
- Expresswash-native and Goalhub-ingested financial data.
- Journal posting, allocations, reversals, refunds, VAT, receivables, payables,
  cash flow, profit and loss, and balance-sheet reconciliation.
- Supabase migrations, RLS, RPCs, triggers, Edge Functions, logs, and secrets.
- Render build, deployment, runtime headers, routes, and production smoke tests.
- PesaPal payment and refund behavior.
- Desktop, tablet, and mobile behavior, accessibility, errors, loading states,
  empty states, and every visible interactive control.

## 2. Non-negotiable safety rules

1. Use the local Supabase stack and PesaPal sandbox for mutation-heavy QA.
2. Production QA is read-only unless the owner explicitly authorizes a named,
   bounded mutation. Never infer permission to create, reverse, refund, void,
   delete, backfill, or replay production financial data.
3. Wrap direct database test mutations in a transaction and `ROLLBACK`. Verify
   row counts and balances both before and after the rollback.
4. Never delete posted accounting records. Correct posted records with a
   reversal, credit note, refund, or traceable adjustment.
5. Never paste a service-role key, PesaPal secret, Render API key, ingest secret,
   access token, or customer data into this document, a commit, a PR, a test
   snapshot, terminal output, or browser screenshot.
6. The Render API key previously shared in chat must be rotated. Store its
   replacement in the approved secret store or agent connector, never in Git.
7. **Security prerequisite:** `src/test/integration/helpers.ts` currently contains
   a production Supabase service-role credential. Before running the integration
   suite, rotate that credential and change the helper to require environment
   variables. Do not run `npm run test:integration` until this is resolved.
8. Do not test a real PesaPal refund with a material amount. Use sandbox first.
   A live refund requires the owner's explicit approval, a named payment, an
   agreed amount, and a cleanup/reconciliation plan.
9. Redact phone numbers, emails, transaction codes, and IDs in shared evidence.
10. Record the exact commit SHA, environment, date, actor role, and business scope
    for every QA result.

## 3. Environment and access inventory

### 3.1 Local environment

| Resource | Value |
| --- | --- |
| Repository | `/Users/nathanngethe/Documents/WorkProjects/Expresswash-ke` |
| Web app | `http://localhost:8080` |
| Sign in | `http://localhost:8080/auth/signin` |
| Admin Accounts | `http://localhost:8080/admin/accounts` |
| Supabase API | `http://127.0.0.1:54321` |
| Local Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Supabase Studio | `http://127.0.0.1:54323` |

Local ledger fixture accounts are disposable and must never be created in
production:

| Role | Email | Password | Expected access |
| --- | --- | --- | --- |
| Super admin | `super@ew.local` | `Passw0rd!` | All businesses and consolidated scope |
| Regular admin | `reg@ew.local` | `Passw0rd!` | Expresswash only |
| Customer/non-admin | `staff@ew.local` | `Passw0rd!` | No admin access |

Shared end-to-end QA accounts supplied by the owner:

| Role | Email | Password | Required coverage |
| --- | --- | --- | --- |
| Customer | `ngethenan768+user@gmail.com` | `TestExpressWash2026!` | Customer portal and customer RLS |
| Driver | `ngethenan768+driver@gmail.com` | `TestExpressWash2026!` | Driver routes, jobs, and driver RLS |
| Invited customer | `ngethenan768@gmail.com` | `TestExpressWash2026!` | Invitation acceptance and resulting customer access |
| Warehouse | `ngethenan768+warehouse@gmail.com` | `TestExpressWash2026!` | Warehouse navigation, workflow, and warehouse RLS |
| Admin | `ngethenan768+admin@gmail.com` | `TestExpressWash2026!` | Admin and accounting surfaces |

These are application QA credentials, not database or infrastructure secrets.
Use them only in the intended environment. Do not place them in automated test
logs, screenshots, browser recordings, or provider payloads. Confirm the visible
role after every login; a successful login with the wrong role is a failed test.

Get local keys at runtime with `supabase status`. Do not copy them into source
files. The local service-role key may be used only against `127.0.0.1`.

Start the local services:

```bash
cd /Users/nathanngethe/Documents/WorkProjects/Expresswash-ke
supabase start
npm install
npm run dev
```

If the local database is disposable and a clean replay is required:

```bash
supabase db reset
```

Confirm with the owner before resetting any local database that may contain
useful manual fixtures.

### 3.2 Production environment

| Resource | Identifier |
| --- | --- |
| Web URL | `https://expresswash-web.onrender.com` |
| Render service | `expresswash-web` / `srv-da3tv40ae00c7397smhg` |
| Render workspace | `My Workspace` / `tea-d0nqbdali9vc7388p93g` |
| Render branch | `main` |
| Supabase project ref | `bsmlzvenkeumebfbpsab` |
| Supabase URL | `https://bsmlzvenkeumebfbpsab.supabase.co` |
| Ledger ingest URL | `https://bsmlzvenkeumebfbpsab.supabase.co/functions/v1/ledger-ingest` |
| GitHub repository | `newtvn/Expresswash-ke` |

Production credentials are deliberately referenced, not embedded:

- Render API access: approved Render connector or `RENDER_API_KEY` in the secure
  operator environment.
- Supabase CLI: authenticated CLI linked to project
  `bsmlzvenkeumebfbpsab`; use an owner-approved token.
- Supabase client: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the
  Render service environment.
- Supabase service-role access: secure secret manager only. It must never use a
  `VITE_` prefix or enter a browser bundle.
- PesaPal: Supabase Edge Function secrets `PESAPAL_CONSUMER_KEY`,
  `PESAPAL_CONSUMER_SECRET`, `PESAPAL_IPN_ID`, and
  `PESAPAL_ENVIRONMENT`.
- Goalhub ingest: `LEDGER_INGEST_SECRET` in both the Goalhub server environment
  and the Expresswash `ledger-ingest` Edge Function environment.

The shared accounts in section 3.1 may be used for production **read-only** browser
testing. Mutation testing in production still requires explicit, per-action owner
authorization. Infrastructure and provider credentials remain secret-manager
only.

### 3.3 Expected Supabase Edge Functions

The local and deployed inventories must contain the same eight functions:

```text
create-user
generate-pdf
ledger-ingest
notification-worker
payment-callback
refund-payment
send-notification
stk-push
```

`payment-callback` and `ledger-ingest` have deliberate public webhook entry
points and must enforce their own verification/shared-secret boundaries. Do not
change JWT verification flags without reviewing the function-level controls.

## 4. QA agent operating contract

### 4.1 Before touching code

1. Read this runbook, `docs/ACCOUNTING_AUDIT_TRACKER.md`,
   `docs/ACCOUNTING_CORE_HANDOFF.md`, and the latest relevant review.
2. Record `git status --short`, current branch, `git rev-parse HEAD`, base branch,
   and open PR number.
3. Preserve unrelated user changes. Never stage or rewrite files outside the
   verified fix scope.
4. Convert each reported issue into a reproducible acceptance criterion with an
   expected result and evidence field.
5. Establish a clean baseline before changing code. If the baseline itself
   fails, investigate it; do not assume the failure is pre-existing.

Current known release blocker to reproduce first:

```text
Route: /admin/invoices
Actor: admin
Action: click Payment on invoice INV-20260909-FB2D67
Observed: Admin Page Error — “Edit2 is not defined”
Secondary failure: subsequent client-side navigation remains on the error page;
                  recovery requires a hard refresh on another route.
Expected: the Record Payment dialog opens for the selected invoice, and any
          error boundary permits normal navigation/recovery without a hard refresh.
```

Treat the undefined icon/import and the sticky error-boundary/navigation behavior
as two independently verified defects even if one action exposes both. Fixing the
missing symbol is insufficient unless recovery and navigation are also tested.

### 4.2 Stop, fix, verify, then proceed

For every failure:

1. **Stop the current checklist.** Capture the exact role, business, route,
   record ID, inputs, expected result, actual result, console/network error, and
   relevant database state.
2. **Reproduce deterministically.** Confirm the failure a second time and reduce
   it to the smallest reliable scenario.
3. **Trace the whole path.** Follow UI component -> hook/application service ->
   repository -> RPC/table -> trigger/journal -> report. For provider flows,
   include Edge Function -> provider response -> callback/IPN -> status events.
4. **Write or improve a failing test first** when practical. Accounting defects
   require a database assertion or domain test, not only a screenshot.
5. **Fix the root cause with the smallest coherent change.** Do not patch a
   displayed total while leaving the canonical query wrong.
6. **Verify the fix at three levels:** targeted automated test, direct data/RPC
   assertion, and the original browser reproduction.
7. **Run adjacent regression checks.** A refund fix must recheck Payments
   Received, cash flow, A/R, the ledger, business scoping, and idempotency.
8. **Resume the checklist only after all affected checks pass.** Update the
   tracker with evidence and the fixing commit.

If the agent cannot fix a failure without destructive production action, new
credentials, provider approval, or a product/accounting decision, mark it
`BLOCKED`, explain the exact boundary, and stop. Do not mark the run passed.

### 4.3 Coding and review standards

- Keep one canonical implementation for currency conversion, local-date
  formatting, overdue calculation, business scoping, payment status mapping,
  and accounting report queries. Reuse shared helpers instead of cloning logic.
- Reports must derive from canonical operational records or balanced journal
  entries, never independently summed UI fields.
- Use the application/repository boundary already present under
  `src/services/accounting`; React components must not grow duplicate financial
  rules.
- Prefer provider-neutral interfaces. PesaPal-specific HTTP payloads belong in
  the server-side provider adapter, never in React components.
- Never swallow a data-loading error and return an empty collection. An error is
  not an empty state. Throw/return a typed failure and render a visible retryable
  error state.
- Financial writes must be atomic, business-scoped, authorized, idempotent where
  retried, and protected against concurrent over-allocation/over-refund.
- Use database constraints and row locks for invariants that cannot safely be
  guaranteed by UI validation alone.
- Comments explain **why**, risk, or an external constraint. Do not narrate
  obvious code. Remove stale comments when behavior changes.
- Avoid large unrelated refactors during a fix. If a reusable extraction is
  necessary, keep it behavior-preserving and test it separately.
- Do not use `any` to bypass accounting or provider response validation. Parse
  external responses defensively.
- Preserve `prefers-reduced-motion`, keyboard access, focus management, and
  responsive behavior for UI changes.
- Every bug fix needs regression coverage at the lowest meaningful layer and a
  browser confirmation at the user-facing layer.

## 5. Test data and cleanup

Use unique prefixes such as `QA-<date>-<short-id>` in memos, references, invoice
numbers, and provider sandbox references. Keep a manifest of every created row.

Required local fixture set:

- One Expresswash and one Goalhub customer/contact.
- One supplier.
- Draft, posted, partially paid, paid, overdue, and reversed invoices.
- Cash, bank, M-Pesa/PesaPal, and Goalhub payments.
- Allocated and unallocated payment portions.
- Pending and approved expenses.
- Open and paid supplier bills.
- Credit note, customer credit, manual refund, provider refund request, and
  reversed journal fixtures.
- Goalhub ingest success, duplicate replay, invalid mapping, and failed-event
  fixtures.

Cleanup must respect foreign keys and audit requirements. Delete only disposable
local fixtures. In production, reverse or otherwise correct records according to
policy; never erase their history.

## 6. Automated baseline gates

Run from a clean working tree before browser QA and again after all fixes:

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
npm run performance:check
```

Expected result: zero TypeScript errors, zero lint errors, all tests passing, and
a successful production build. Existing warnings must be listed by exact rule
and file; a new warning fails the gate.

Run the accounting database integrity suite against local Supabase:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/accounting_integrity.sql
```

The suite must complete successfully and roll back its fixtures. Negative tests
must assert the intended SQLSTATE or exact error fragment so they cannot pass for
the wrong reason.

Do not run `npm run test:integration` until the credential issue in section 2 is
fixed. After remediation, the suite must be environment-selected, default to the
local project, refuse a production hostname unless an explicit safety flag is
present, and never expose a service-role key in logs.

## 7. Migration, schema, RLS, and Edge Function QA

1. Run `supabase db reset` locally. Every migration through the repository's
   latest migration must replay without manual intervention.
2. Compare local migration files with production migration history. A file
   missing from production is a deployment blocker; a production-only version is
   an investigation blocker.
3. Confirm migration `20260909000001` / accounting migration 083 is present in
   production.
4. Verify required RPC signatures exist, including accounting reports, balances,
   payments received, reversal, refund, allocation, invoice, bill, and ingest
   functions.
5. Exercise RLS as super admin, regular admin, customer, anonymous user, and
   service role. A regular admin must never read or write Goalhub data.
6. Verify all eight Edge Functions are deployed. Compare relevant source SHA or
   deployed version to the release commit when the platform exposes it.
7. Invoke webhook/ingest functions with a wrong secret and expect an
   authorization failure. Do not send genuine secrets in captured output.
8. Confirm callback replay and ledger-ingest replay are idempotent.
9. Inspect function and database logs for unhandled exceptions, secret leakage,
   repeated retries, and unexpected 4xx/5xx responses.
10. Confirm all required Edge Function secret **names** exist. Never print their
    values.

Core database invariants:

```sql
-- Global posted trial balance: difference must be exactly 0.00.
SELECT ROUND(SUM(l.debit), 2) AS debit,
       ROUND(SUM(l.credit), 2) AS credit,
       ROUND(SUM(l.debit) - SUM(l.credit), 2) AS difference
FROM ledger_journal_lines l
JOIN ledger_journal_entries e ON e.id = l.journal_entry_id
WHERE e.status = 'posted';

-- Every posted entry must balance: must return zero rows.
SELECT e.id, e.entry_number,
       ROUND(SUM(l.debit) - SUM(l.credit), 2) AS imbalance
FROM ledger_journal_entries e
JOIN ledger_journal_lines l ON l.journal_entry_id = e.id
WHERE e.status = 'posted'
GROUP BY e.id, e.entry_number
HAVING ROUND(SUM(l.debit) - SUM(l.credit), 2) <> 0;
```

Also assert:

- No posted entry has fewer than two complete lines.
- No required source record lacks a business tag.
- No cross-business allocation exists.
- No duplicate reversal exists for one original journal entry.
- Every reversed original has exactly one posted compensating entry.
- Every posted refund links to its source payment/invoice and journal entry.
- Expresswash + Goalhub figures equal consolidated figures for additive reports.
- Payments Received excludes reversed native and external receipts.
- Posting Gaps agrees with direct queries of completed/unposted source records.

## 8. Browser QA protocol

Test at minimum:

- Desktop: 1440 x 900.
- Tablet: 768 x 1024.
- Mobile: 390 x 844.
- Keyboard-only navigation.
- Reduced-motion preference.

At every route:

1. Wait for the page's own loading state to finish; do not rely on arbitrary
   sleeps.
2. Confirm page title, breadcrumbs, active navigation, role, and business scope.
3. Verify loading, populated, empty, and forced-error states.
4. Click every visible button, link, tab, row action, menu item, pagination
   control, filter, date picker, tooltip/info icon, accordion, and dialog action.
5. For a selected row, ensure the detail/dialog content belongs to that exact
   record and includes amount, date, status, source, business, customer/supplier,
   identifiers, references, and linked records as applicable.
6. Verify Back, Cancel, close, Escape, focus return, and browser navigation.
7. Verify mutations show pending state, prevent duplicate submission, show a
   success or actionable error, refresh all affected queries, and persist after
   reload.
8. Confirm there are no horizontal overflows, clipped controls, inaccessible
   content, console errors, failed network calls, or silent error-to-empty-state
   conversions.

### 8.1 Landing and authentication

- Visit every header/footer link and every CTA from the landing page.
- Verify responsive navigation and that signed-out links route correctly.
- Run signup validation, sign in, wrong-password failure, forgotten password,
  OTP/reset flow where a safe test inbox exists, and sign out.
- Verify protected routes redirect correctly for anonymous and wrong-role users.

### 8.2 Customer portal

Click through Dashboard, Request Pickup, My Orders, Favorites, Invoices,
Payments, Loyalty & Rewards, Referrals, Reviews, Addresses, Profile, and
Notifications.

For each list, open at least one detail. Verify amounts, status, order/invoice
relationships, payment history, downloads, and back navigation. Exercise safe
create/edit actions locally. Profile must retain the customer shell; admin users
must never be sent into the customer shell from the admin account menu.

### 8.3 Admin accounting navigation

From the admin sidebar, test Accounts, Invoices, Receipts, Billing, and Profit &
Expense from landing/list screens through all details and dialogs. Verify every
KPI against its underlying rows and canonical RPC, not by visual plausibility.

The admin footer account menu must:

- Display the signed-in identity and correct role.
- Open the admin user-detail/profile route for an admin.
- Preserve the admin sidebar and permissions.
- Never switch an admin into the customer portal shell.

## 9. Admin Accounts tab-by-tab matrix

Run the full matrix as super admin in Expresswash, Goalhub, and consolidated
scope, then as regular admin. Consolidated mode must disable business-specific
writes.

### Reports

- Test all date presets and custom ranges in Africa/Nairobi local dates.
- Reconcile Revenue, Expenses, Net Profit, Outstanding, P&L, Balance Sheet, VAT,
  Cash Flow, Cash by Customer/Admin, and Sales by Item to direct RPC results.
- Balance Sheet must balance and include Current Earnings correctly.
- Open the account-code info control and confirm it explains codes such as 1000,
  1010, 1020, 3000, and 3999 without implying that they are amounts.
- Confirm theme, currency formatting, zero/negative presentation, export/print if
  present, and business scope.

### Ledger

- Open entries for invoice, receipt/payment, expense, bill, credit note, refund,
  Goalhub ingest, manual adjustment, and reversal.
- Detail must show entry number, amount, date, status, source type/source ID,
  business, memo, debit/credit lines, accounts, contact, VAT, and linked reversal.
- Confirm debits equal credits exactly.
- Open the reversal dialog from a posted non-reversal entry. Verify source details
  and amount-specific warning. Reversal must be blocked for drafts, already
  reversed entries, reversal entries, and dates before the original.

### Purchases & Expenses

- Verify filters, totals, status, method, dates, attachments/references, and empty
  and error states.
- Open each detail/action. Locally create a draft expense, edit it, approve/post
  it, and verify the expense journal and report effects.
- A posted expense must not be destructively edited.

### Payments Received

- Verify native Expresswash and Goalhub payments display under the correct scope.
- Confirm completed, pending, failed, and reversed handling.
- Open Payment Trail for each provider/method. It must identify the exact payment
  using amount, payer/customer, invoice/order, business, provider, payment ID,
  provider tracking/reference, confirmation code/receipt, phone audit fields,
  status events, allocations, and refunds.
- Test Allocate and Record Refund dialogs locally. Limits must use the remaining
  unallocated/refundable amount and remain correct under concurrent/repeated
  attempts.
- Reversed receipts must not inflate Payments Received totals.

### Aging Summary

- Reconcile each invoice into Current, 1-30, 31-60, 61-90, or 90+ using Nairobi
  dates and only outstanding balances.
- Verify totals equal A/R and that paid/void/reversed items do not remain overdue.
- Open invoice/customer details from every available clickable element.

### Payables & Bills

- Verify supplier, dates, status, line totals, VAT, outstanding, and aging.
- Locally create, open, post, and pay a bill. Verify DR expense/input VAT and CR
  A/P on posting, followed by DR A/P and CR the chosen cash account on payment.
- Prevent overpayment and cross-business payment.

### Credits & Refunds

- Verify credit notes, customer credits, and refunds are distinguishable.
- Open linked customer, invoice, payment, and journal details.
- Verify amount, method, reference, reason, provider status, actor, and timestamps.
- Confirm void/reversal behavior refreshes every affected report.

### Posting Gaps

- Reconcile every displayed count and amount to direct source queries.
- Verify completed payments, issued invoices, approved expenses, posted bills,
  and external events do not silently remain unposted.
- Each row must navigate to enough source detail to diagnose and safely repair it.
- A green empty state is valid only after the direct gap query also returns zero.

### Contacts

- Test search/filter, create, open, edit, customer/supplier classification, tax
  fields, and all linked invoices, payments, bills, credits, and refunds.
- Confirm business visibility and duplicate-contact behavior.

### Outbox

- Verify pending, processing, delivered, failed, retry, replay, attempts, next
  attempt, error, channel, recipient, source, and timestamps.
- Retry/replay must be idempotent and must not duplicate financial postings.
- Ensure sensitive payload fields are redacted in the UI and logs.

## 10. Accounting workflow assertions

For each local workflow, capture the operational row and exact journal lines:

| Workflow | Expected accounting effect |
| --- | --- |
| Issue invoice | DR Accounts Receivable; CR Revenue; CR VAT Payable when applicable |
| Receive payment | DR selected cash/bank/M-Pesa account; CR Accounts Receivable or Customer Credits |
| Approve expense | DR expense; DR Input VAT when applicable; CR selected cash/payable account |
| Post supplier bill | DR expense/asset and Input VAT; CR Accounts Payable |
| Pay supplier bill | DR Accounts Payable; CR selected cash/bank account |
| Credit note | Reverse the applicable revenue/VAT and reduce A/R or create customer credit |
| Customer refund | DR A/R/customer-credit side; CR the actual cash/bank/M-Pesa account after money is sent |
| Journal reversal | Swap every original debit and credit; preserve both entries; net effect zero |

After every workflow, verify:

- Operational status and remaining balances.
- Correct business, contact, source ID, reference, actor, and date.
- Exactly one expected journal (or one original plus one reversal).
- Entry balance of exactly KES 0.00.
- Expected P&L, Balance Sheet, VAT, Cash Flow, A/R, A/P, Payments Received,
  and Posting Gaps changes.
- Correct behavior after reload and under duplicate/replayed requests.

## 11. Reversal and refund semantics

These terms must never be conflated in the UI, code, tests, or operator training:

- **Reverse journal entry** corrects the books by posting an equal-and-opposite
  journal. It does not contact a payment provider and cannot return customer
  money.
- **Record manual refund** records a refund that an operator has already sent by
  cash, bank, M-Pesa, or another external channel. It posts the resulting cash
  movement. It does not itself transfer money.
- **Request PesaPal refund** asks PesaPal to return a completed PesaPal payment to
  the originally charged card or mobile-money wallet. Acceptance of the request
  means processing has started; it does not prove that the customer has received
  the funds.

Recommended UI labels:

- `Reverse Ledger Entry` with helper text: “Accounting correction only. No money
  will be sent to the customer.”
- `Record Refund Already Sent` for manual refunds.
- `Request Refund Through PesaPal` only when an eligible PesaPal payment and the
  provider refund integration are available.

The confirmation dialog must repeat the distinction and display the exact
customer, original amount, requested amount, method, provider confirmation code,
business, and resulting accounting treatment.

## 12. PesaPal refund integration specification

### 12.1 Feasibility and provider constraints

PesaPal API 3.0 exposes `POST /api/Transactions/RefundRequest`. According to the
official documentation, it returns funds to the card or mobile-money wallet that
was originally charged. The request requires the original payment confirmation
code, amount, initiating username, and remarks.

Enforce all provider constraints server-side:

- Original payment must be `COMPLETED`.
- Refund amount may not exceed the original collection.
- Card payments may be partially or fully refunded.
- Mobile-money payments may only be fully refunded.
- Refund currency must equal the original currency.
- Only one refund request is permitted per payment.
- A successful API response means “received and processing,” not “effected.”
- Merchant approval is still required before PesaPal finalizes the refund.

The existing accounting refund RPC permits partial and cumulative refunds, so it
must not be called directly as the provider-refund engine. Provider eligibility
rules need a separate server-side workflow.

### 12.2 Recommended architecture

1. Add a provider-neutral `requestRefund` operation to the server-side payment
   provider interface.
2. Implement it in the PesaPal adapter using the same short-lived bearer-token
   authentication as payment submission/status checks.
3. Add a Supabase Edge Function such as `refund-payment`. It must accept an
   authenticated admin request, never provider credentials from the browser.
4. In a database transaction, lock the payment and verify role, business,
   provider, completed status, confirmation code, currency, prior requests, and
   provider-specific amount rules.
5. Create an idempotent refund-request row before the external call, keyed by the
   payment and an idempotency key. Persist sanitized request/response evidence,
   actor, timestamps, and status transitions.
6. Submit the PesaPal refund using the stored confirmation code. Never trust a
   confirmation code supplied by the browser.
7. On PesaPal acceptance, set provider state to `requested` or `processing`—not
   `completed` and not `refunded`.
8. Do not post the final cash-out journal merely because PesaPal accepted the
   request. Post it only when completion is independently confirmed. If PesaPal
   provides no machine-readable completion callback/status for the merchant
   account, require an authorized reconciliation step with PesaPal evidence.
9. When completion is confirmed, atomically create/link the customer refund and
   its journal entry, then invalidate Accounts, Payments, Invoices, Receipts, and
   report caches.
10. Failed or rejected requests must remain visible and retryable without
    creating duplicate provider requests or journal entries.

Suggested provider-refund states:

```text
draft -> submitting -> requested -> processing -> completed
                    \-> rejected
                    \-> failed_retryable
requested/processing -> cancelled only if PesaPal explicitly supports it
```

Keep provider state separate from the accounting journal status. The two become
linked when the refund is confirmed completed.

### 12.3 PesaPal refund QA

Run in sandbox first:

1. Complete a sandbox card payment; store its provider tracking ID and
   confirmation code.
2. Request a partial card refund and verify provider acceptance is shown as
   processing, with no premature completed journal.
3. Request a full card refund in a separate fixture.
4. Complete a sandbox mobile-money payment; verify partial refund is blocked
   before the provider call and full refund is accepted.
5. Verify pending/failed payments, missing confirmation codes, wrong business,
   excessive amounts, second refund attempts, duplicate clicks, replayed
   requests, and unauthorized roles are rejected.
6. Simulate network timeout after submission and prove retry/reconciliation does
   not issue a second refund.
7. Confirm a completed provider refund exactly once; verify the refund row,
   journal, cash account, A/R/customer-credit effect, Payment Trail, Credits &
   Refunds, Cash Flow, Balance Sheet, and audit log.
8. Confirm a rejected refund creates no cash-out journal and remains actionable.
9. Verify no provider token, consumer secret, or full raw customer payload appears
   in browser responses or logs.
10. Perform one explicitly authorized low-value live refund only after sandbox,
    security review, and merchant approval workflow all pass.

Official references:

- PesaPal API 3.0 Refund Request:
  `https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/refund-request`
- PesaPal API 3.0 Authentication:
  `https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/authentication`
- PesaPal API 3.0 Reference:
  `https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/api-reference`

## 13. Render deployment QA

1. Confirm the intended PR(s) are merged and `main` contains the exact reviewed
   commits.
2. Confirm Render auto-deploy selected that `main` commit. Do not accept “live”
   when the commit SHA differs.
3. Monitor build and deploy logs to terminal success. Investigate warnings that
   indicate missing environment variables, asset failures, or runtime mismatch.
4. Verify the production root, `/admin`, `/admin/accounts`, `/pricing`, `/track`,
   `/privacy`, `/terms`, `/faq`, `/contact`, and `/services` return expected
   status/content and SPA deep links survive direct reload.
5. Confirm CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
   Permissions-Policy, and immutable asset caching.
6. Run a signed-out smoke, least-privilege customer smoke, and authorized admin
   read-only accounting smoke.
7. Inspect browser console/network and Render/Supabase logs for the deployment
   window.
8. Confirm no secret value is present in the built JavaScript. Public anon and
   maps keys are expected client configuration; service-role/provider secrets
   are forbidden.
9. Keep monitoring through at least one application cold start and one Supabase
   request cycle. A successful static build alone is not deployment sign-off.

## 14. Final regression and evidence package

After the last fix, repeat all automated gates, the complete affected browser
matrix, accounting integrity SQL, migration/function inventory, and production
read-only smoke.

Save a dated result under `docs/` or `reviews/` containing:

```text
Commit SHA:
PR(s):
Tester/agent:
Date and timezone:
Local/production URLs:
Browser and viewport matrix:
Supabase project ref and latest migration:
Edge Function inventory:
Render deploy ID, status, and deployed commit:
Automated command results:
UI matrix result by route/tab:
Accounting reconciliation evidence:
PesaPal sandbox/live evidence (redacted):
Console/network/log findings:
Defects found and fixing commits:
Residual risks or blockers:
Final verdict: PASS / FAIL / BLOCKED
```

Screenshots supplement assertions; they do not replace database evidence. Never
include secrets or unredacted customer/provider data.

## 15. Release gate

The release is ready only when all of the following are true:

- Type-check, lint, unit tests, build, performance check, and local accounting
  integrity SQL pass.
- Local migrations replay cleanly and production migration history matches the
  intended release.
- Required Edge Functions and secret names are present and their security
  boundaries pass negative tests.
- Every relevant route, tab, row, detail, dialog, link, and action has been
  exercised at the required roles/scopes/viewports.
- All displayed accounting figures reconcile to canonical queries and journals.
- Trial balance and every posted journal entry balance exactly.
- Expresswash, Goalhub, and consolidated scoping reconciles and RLS isolates.
- Reversals, manual refunds, and PesaPal refunds are accurately distinguished.
- PesaPal acceptance is never presented or posted as a completed refund.
- Every discovered defect is fixed and reverified, or the run is explicitly
  `BLOCKED`; no unresolved defect is hidden behind an approval.
- Render is live on the reviewed SHA and the production read-only smoke is clean.
- The evidence package is complete, redacted, and reproducible.
