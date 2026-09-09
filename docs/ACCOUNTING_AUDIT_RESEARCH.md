# Accounting integrity research

Date: 2026-09-09

## Control baseline

This implementation treats posted accounting records as immutable evidence. Corrections are made with linked offsetting entries, not deletion or silent editing. A user must be shown the significant transaction data they are authorising, while the server re-derives and validates that data at execution time.

The baseline is grounded in:

- [IFRS IAS 8](https://www.ifrs.org/issued-standards/list-of-standards/ias-8-basis-of-preparation-of-financial-statements/), which distinguishes correction of errors from changes in estimates and requires reliable correction and presentation.
- [IAASB ISA 230](https://www.iaasb.org/consultations-projects/audit-documentation-isa-230), which establishes the importance of sufficient audit documentation.
- [IAASB audit evidence guidance](https://www.iaasb.org/consultations-projects/audit-evidence-and-risk-response-isa-330-isa-500-isa-520), which emphasizes sufficient, appropriate evidence and professional skepticism.
- [KRA eTIMS guidance](https://www.kra.go.ke/images/publications/NEW-Online-Portal-Userguide-2026.pdf), where credit-note creation begins from a selected invoice and presents the invoice, buyer, taxable amount, VAT, total, and line items before correction.
- [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html), which requires significant transaction data to be server-generated, displayed for verification, and checked again at execution.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html), which informs locking and atomic server-side state transitions.

## Repository findings

1. Generic journal reversal displayed only journal number, type, date, status, and memo. It omitted amount, accounts, debit/credit lines, source reference, and business.
2. `reverse_journal_entry` is `SECURITY DEFINER` and did not explicitly validate access to the selected journal's business before reversal.
3. No focused automated tests covered journal reversal or customer refund invariants.
4. Billing KPIs used invoice totals for partially paid and overdue invoices instead of remaining balances, excluded overdue balances from outstanding, and included non-issued documents in total invoiced.
5. Profit & Expense used paid-invoice and legacy-expense aggregates instead of the canonical posted ledger, allowing disagreement with Accounts reports.
6. Receipts ignored the selected tag, calculated “This Month” without comparing the year, swallowed query failures, and permanently deleted source documents from the UI.
7. The linked database contains the accounting objects, but its migration-history ledger does not enumerate the timestamped local migrations consistently. This is deployment-process debt and must be verified during release.
8. Goalhub cash receipts were posted into the shared ledger and therefore appeared in reports, but the Payments Received tab queried only the native `payments` table. The two surfaces used different source populations.
9. Customer refunds had no persisted business dimension and unapplied-customer-credit reporting was global, allowing consolidated data to appear under a single-business selection.
10. Receivable and payable aging included operational documents that had not yet been posted to the accounting ledger.

## Required invariants

- Every posted journal balances to the cent and contains at least two non-zero, one-sided lines.
- Reversal is allowed once, against a posted entry, within the caller's business scope, and never before the original entry date.
- A reversal mirrors every original debit/credit line and retains a durable link to the original.
- Confirmation identifies the business event by source reference, amount, date, memo, business, and account breakdown; UUIDs remain secondary audit identifiers.
- Invoice KPIs use issued documents and remaining balances; overdue is a subset of outstanding.
- Profit and expense figures come from posted ledger entries for one explicit reporting period and business scope.
- Receipt totals state their filter scope, use local calendar dates, and preserve records; removal is not exposed as a routine UI action.
- Payments Received is derived from actual cash-side ledger movements, includes native and externally ingested cash once, and excludes non-cash wallet movements.
- Refunds and unapplied credits inherit and enforce the business of their source transaction.
- Aging includes only ledger-backed invoices and bills.
- All write controls remain server-side and are exercised against local data only during validation.
