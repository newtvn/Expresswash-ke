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
