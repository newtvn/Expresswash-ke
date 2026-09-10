# Accounting audit task tracker

Status values: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED`.

| ID | Area | Severity | Work item | Verification | Status |
|---|---|---:|---|---|---|
| ACC-01 | Accounts / Ledger | Critical | Return business-scoped journal headers, source references, total amount, and complete debit/credit lines from a trusted RPC. | SQL assertions + local browser | DONE |
| ACC-02 | Accounts / Ledger | Critical | Enforce business authorisation, one-time reversal, entry-date ordering, row lock, and mirrored balanced lines in `reverse_journal_entry`. | Local database workflow test | DONE |
| ACC-03 | Accounts / Ledger | High | Replace opaque reversal prompt with full transaction and account breakdown, technical ID, warning, and pending-state protection. | Local browser walkthrough | DONE |
| ACC-04 | Accounts / Refunds | High | Re-run payment refund, cumulative cap, cash credit, AR debit, source linkage, business isolation, and idempotency-adjacent checks locally. | Local database workflow test | DONE |
| ACC-05 | Billing | High | Correct invoiced, received, outstanding, and overdue KPI definitions using issued documents, paid amounts, and balances. | Unit tests with partial/overdue/cancelled fixtures | DONE |
| ACC-06 | Billing | Medium | Ensure list rows expose invoice total, paid amount, balance, and correct detail navigation. | Local browser walkthrough | DONE |
| ACC-07 | Profit & Expense | Critical | Replace legacy paid-invoice/expense KPIs with canonical posted-ledger P&L for an explicit period and business. | RPC reconciliation + local browser | DONE |
| ACC-08 | Profit & Expense | High | Make expense approval/posting behavior explicit and reconcile approved expenses to ledger entries. | Local database workflow test | DONE |
| ACC-09 | Receipts | High | Apply tag filtering, year-aware month totals, explicit query errors, precise filtered-total labels, and positive amount validation. | Source checks + local browser | DONE |
| ACC-10 | Receipts | High | Remove routine hard-delete control for accounting source documents; preserve the audit record. | SQL assertion + local browser | DONE |
| ACC-11 | Invoices | Critical | Reconcile line subtotal, discount, tax, total, paid amount, balance, payment, credit-note, and posting paths. | Validation constraints + local browser | DONE |
| ACC-12 | All five pages | High | Verify loading, empty, error, filtering, business scope, responsive layout, keyboard/dialog behavior, and detail paths locally. | Desktop browser walkthrough + responsive source/build checks | DONE |
| ACC-13 | Regression | High | Run type-check, lint, unit, integration, build, database assertions, and browser smoke suite. | Evidence below | DONE |
| ACC-14 | Deployment | High | Verify migration order before applying and document release requirements without mutating production during tests. | Local migration ledger + release note below | DONE |
| ACC-15 | Delivery | High | Commit cleanly, push branch, and open a PR containing scope, risk, migration, and test evidence for user review. | [PR #67](https://github.com/newtvn/Expresswash-ke/pull/67) | DONE |
| ACC-16 | Accounts / Payments | Critical | Reconcile Payments Received with Goalhub cash-receipt ingest events while excluding non-cash wallet/redemption/refund movements and preventing double-counting. | RPC reconciliation + local Goalhub fixtures + UI | DONE |
| ACC-17 | Admin Invoices / Payment | Critical | Fix the Payment action crash on `/admin/invoices` (`Edit2 is not defined`) and verify the dialog is bound to the exact selected invoice, amount, balance, and business. Reproduce with `INV-20260909-FB2D67`, but regression-test a stable fixture rather than depending on that production record. | Component regression test + local browser + production read-only open/cancel smoke | IN PROGRESS |
| ACC-18 | Admin error recovery | Critical | Fix the sticky admin error-boundary state that prevents subsequent navigation after a page exception and currently requires a hard refresh. Verify Try Again, Home, Reload, sidebar links, account menu links, browser Back/Forward, and direct route changes recover safely. | Injected render-error test + keyboard/browser route walkthrough | IN PROGRESS |
| ACC-19 | PesaPal refunds | Critical | Implement a provider-backed refund-request workflow so eligible completed PesaPal payments can return money to the originally charged card/mobile wallet. Keep request/processing/completed states separate; enforce full-only mobile refunds, card partial/full rules, one request per payment, idempotency, business authorization, and delayed journal posting until completion evidence exists. | PesaPal sandbox suite + DB concurrency/integrity assertions + explicitly authorized low-value live test | IN PROGRESS |
| ACC-20 | Security / test credentials | Critical | Rotate the production Supabase service-role key currently embedded in `src/test/integration/helpers.ts`; replace hard-coded project credentials with runtime environment variables and add a guard that refuses production integration tests without an explicit safety opt-in. | Secret scan + revoked-key check + local integration suite | BLOCKED |
| ACC-21 | Full-system QA | Critical | Execute `docs/ACCOUNTING_END_TO_END_QA_RUNBOOK.md` across landing/auth, customer, driver, warehouse, admin, every accounting tab/detail/action, Supabase, Goalhub ingest, PesaPal, and Render. Stop/fix/retest on every defect and produce a redacted evidence report. | Complete dated QA evidence package with reviewed SHA and deployment IDs | BLOCKED |

## Verification evidence

- `npx tsc --noEmit`: pass.
- `npm run lint`: pass with 0 errors and 9 pre-existing warnings outside this change.
- `npm run build`: pass, including all route-specific HTML generation.
- `supabase/tests/accounting_integrity.sql`: pass in a rollback-only local transaction.
- `supabase db lint --local`: 0 errors; two pre-existing unused-variable warnings.
- Vitest: 160/163 pass. The three failures are pre-existing mutable-remote driver workflow cases: `driver_routes` RLS and an invalid order transition from status 2 directly to 6. This branch changes neither area; the accounting unit suites pass.
- Local browser: verified Accounts, Invoices, Receipts, Billing, and Profit & Expense with a partial invoice, active/void receipt pair, pending/posted expenses, Goalhub external cash, business switching, journal details, and reversal confirmation.

## Release note

Migration `20260909000001_083_journal_reversal_integrity.sql` is last in timestamp order and applies idempotently to the local stack. The local migration ledger aligns through `083`. Production migration history and a backup must be verified by the deployer immediately before applying it; this audit did not mutate production.

## Open blockers added 2026-09-09

- **ACC-17:** Admin invoice Payment currently throws `ReferenceError: Edit2 is not
  defined` instead of opening the payment dialog.
- **ACC-18:** after that exception, admin navigation remains trapped in the error
  fallback until a hard refresh. This must be tested and fixed independently from
  the missing icon import.
- **ACC-19:** existing `Record Refund` is accounting-only. Automatic customer
  repayment requires the PesaPal Refund Request workflow and settlement-aware
  reconciliation described in the QA runbook.
- **ACC-20:** production service-role material in a tracked test helper must be
  rotated and removed before the production integration suite is considered safe.
- **ACC-21:** the new end-to-end runbook is the release gate; prior partial
  walkthrough evidence does not close it.

## QA continuation evidence — 2026-09-10 EAT

- ACC-17 code fix is present and the production build resolves the `Edit2`
  symbol. Its authenticated browser open/cancel smoke remains blocked by the
  unavailable controlled-browser connection.
- ACC-18 now resets the admin error boundary on pathname changes and has a
  passing injected-error regression test. The full Back/Forward, menu, and
  keyboard route matrix remains blocked by the same browser connection.
- ACC-19 is implemented locally with migration `084`, a `refund-payment` Edge
  Function, provider adapter, repository/application layer, and admin UI. Local
  PesaPal-mock coverage passes card partial/full, mobile full-only, rejection,
  timeout replay, authorization, delayed posting, and completion idempotency.
  Provider-state transitions are service-role-only; a direct super-admin RPC is
  denied by a passing SQL assertion.
  Production migration `084` and `refund-payment` version 1 were deployed on
  2026-09-10 after a one-file dry-run. Missing-auth, customer-denial, and safe
  admin/nonexistent-payment smokes pass; no genuine refund was initiated.
- ACC-20 source remediation and the production-host opt-in guard pass. Rotation
  and revocation of the formerly tracked production credential cannot be proven
  from repository or read-only platform access and remains a release blocker.
- ACC-21 evidence is in
  `docs/ACCOUNTING_END_TO_END_QA_EVIDENCE_2026-09-10.md`. Automated, database,
  local mock, public-route, header, and secret scans pass. Deployment alignment,
  authenticated browser matrices, provider live/sandbox confirmation, and key
  rotation remain blocked.
