# Accounting Review Follow-up QA

Date: 2026-09-09

Environment: local Vite application with local Supabase

Actor: `super_admin`

This pass validates the review follow-ups on top of PR #67 and the complete interactive surface of **Admin → Accounts**. All mutations that could alter accounting data were stopped at their confirmation dialogs.

## Review findings

| Finding | Resolution |
| --- | --- |
| Expense reads hid failures as empty results | `getExpenses` and `getExpenseSummary` now throw query errors so the page error state can render. |
| Reversed receipts remained in Payments Received | Native payments whose journal was reversed and reversed external entries are excluded by the canonical RPC. |
| Negative SQL tests could pass for the wrong error | Assertions now check the expected message or SQLSTATE. |
| Date and overdue logic was duplicated | Local-calendar formatting and outstanding-overdue evaluation are shared and unit-tested. |
| Quick report presets shifted dates through UTC | The shared picker now formats local calendar dates; a 30-day preset was browser-verified as 2026-08-10 through 2026-09-09 in Nairobi. |
| Voiding a receipt left accounting caches stale | Receipt void success now invalidates receipts, Accounts, and accounting query families. |
| Accounts read failures were not consistently surfaced | Every Accounts query is included in the page error state; setup, operational, and outbox reads throw instead of returning false empty states. |
| Admin footer profile opened the customer portal | The footer now opens the signed-in user's admin detail route, preserving the admin shell and displaying the role. |

## Accounts tab matrix

| Tab | Data/state verified | Safe interactions verified |
| --- | --- | --- |
| Reports | P&L, balance sheet, VAT, cash flow, cash by customer/admin, and sales by item reconcile to the posted fixtures. | Date-range controls and account-code explanation control render and are operable. |
| Ledger | Posted invoice, payment, and expense journals show entry numbers, dates, sources, amounts, and lines. | Reversal dialog opens with amount, source, date, business, journal ID, debit/credit lines, warning, and amount-specific confirmation. Cancel verified. |
| Purchases & Expenses | Pending KES 450 and posted KES 300 fixtures display with correct status/method/date. | Add Expense dialog opens with all required fields. Cancel verified. |
| Payments Received | Expresswash KES 800 receipt and Goalhub KES 1,750 receipt appear under their correct business scopes. | Trail, allocation, and refund dialogs open with the selected payment's customer, amount, status, identifiers, limits, and invoice options. Cancel verified. |
| Aging Summary | KES 1,288 open invoice appears in the current bucket. | Tab selection and content loading verified. |
| Payables & Bills | Correct empty state displays for the fixture set. | Add Supplier Bill opens with supplier, line, VAT, account, dates, total, and posting explanation. Cancel verified. |
| Credits & Refunds | Correct empty state displays for the fixture set. | Tab selection and content loading verified. |
| Posting Gaps | No-gap state agrees with the fully posted fixture set. | Tab selection and content loading verified. |
| Contacts | Existing accounting contacts display. | Add Contact dialog opens with type and identity/tax fields. Cancel verified. |
| Outbox | Correct empty state displays for the fixture set. | Tab selection and content loading verified. |

## Cross-cutting validation

- Business switching updates both headline totals and tab content; Goalhub receipt visibility was explicitly verified.
- Admin footer **My Profile** resolves to `/admin/users/:id`, keeps the admin navigation, and visibly reports `super admin`.
- Accounts renders and remains navigable at a 390 × 844 mobile viewport.
- Browser console contained no errors after the complete click-through.
- Reversal integrity SQL was executed against local Supabase in a transaction and rolled back.
