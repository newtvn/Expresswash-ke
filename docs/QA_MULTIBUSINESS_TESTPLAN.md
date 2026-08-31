# QA Test Plan — Multi-Business Hub + Goalhub on Render

Final acceptance checklist for the QA tester's **chrome-mcp** run, plus the API/DB
checks that back each UI behaviour. Living doc — updated as each phase (B2, B3, C,
Goalhub cutover) lands. Status legend: ☐ not ready · ▶ ready to test · ✅ verified.

**Test accounts needed**
- `super_admin` — full multi-business access (sees the switcher, all businesses).
- `admin` (regular) — Expresswash only (no switcher, no other business).
- A non-admin user — must not reach the Accounts area at all.

## Already verified (local chrome-mcp run, Docker Supabase stack, seeded Expresswash + Goalhub)
- **super_admin**: switcher renders (All businesses / Expresswash / Goalhub + Add business); switching re-scopes every report — Expresswash Net **KES 3,200**, Goalhub Net **KES 4,000** (Turf Revenue; Expresswash accounts show 0), consolidated Net **KES 7,200** = 3,200 + 4,000 (reconciles); Bill/Expense/Journal disabled in consolidated, Contact stays enabled.
- **regular admin**: no switcher (static "Expresswash"); Expresswash-only figures; Goalhub ledger rows filtered out (RLS) even in the raw journal list.
- Balances render via `get_ledger_account_balances()` (revoked-view read path replaced); no console errors; `tsc` + `vite build` clean.
- **Still to test in the final run**: non-admin has no Accounts access; per-business CRUD **through the UI dialogs** (create a Goalhub invoice/bill/expense as super_admin); Add-business dialog inserts + appears in switcher; Goalhub-on-Render (Workstream A).

---

## 1. RBAC & the business switcher (Workstream C on B2)  ☐
- [ ] As **super_admin**: the BusinessSwitcher renders in the Accounts header with
      options "All businesses (consolidated)", "Expresswash", "Goalhub", "Add business".
- [ ] As **regular admin**: no switcher — a static "Expresswash" label; the app never
      requests another business.
- [ ] As **non-admin**: `/admin/accounts` is not reachable.
- [ ] Switching business refetches every report/panel (no stale data from the previous
      selection); the selection persists across reload.

## 2. Consolidated view (super_admin)  ☐
- [ ] "All businesses" shows consolidated totals **and** a per-business breakdown.
- [ ] Drilling into a business row sets the switcher to that business.
- [ ] Writes (new invoice/bill/expense/payment) are **disabled** in consolidated mode
      (a concrete business is required to write).
- [ ] Reconciliation: Σ(per-business net profit) == consolidated net profit; same for
      AR, AP, and cash. (Guards against double-counting / a missed filter.)

## 3. Per-business isolation (the security-critical checks)  ☐
As **regular admin** (Expresswash-only), these must all hold:
- [ ] Every report shows Expresswash figures only; no Goalhub data anywhere.
- [ ] Requesting Goalhub explicitly (crafted request) is rejected, not silently served.
- [ ] The `ledger_account_balances` view is **not** directly readable (leak closed in
      080); balances come only through the scoped function.
- [ ] Attempting to create a Goalhub invoice/bill/expense is rejected.

As **super_admin**:
- [ ] Selecting Goalhub shows Goalhub-only figures (populated P&L / balance sheet /
      cash flow from ingested entries; friendly empty-states for AR/AP/aging/VAT since
      Goalhub has no native invoices/bills).
- [ ] Selecting Expresswash shows Expresswash-only figures (unchanged from today).

## 4. Full per-business CRUD (super_admin, Workstream B3/C)  ☐
- [ ] super_admin creates a **Goalhub** invoice → its journal entry is tagged
      `business = 'goalhub'` and appears under Goalhub, not Expresswash.
- [ ] Editing a draft can't move it to another business.
- [ ] Payments/credit notes/refunds inherit the parent document's business.
- [ ] "Add business" inserts a registry row that immediately appears in the switcher.

## 5. Regression — Expresswash single-business behaviour unchanged  ▶
- [ ] All existing Accounts screens (P&L, balance sheet, cash flow, VAT, receivables,
      payables, invoices/bills/expenses lists) look and total exactly as before B1.
  - *Backing evidence:* B1 already proven a byte-identical report no-op (074→077) on
    the local stack; re-confirm in the UI after B2/C.

## 6. Goalhub fully on Render (Workstream A)  ☐
- [ ] `https://<goal-backend>/health` returns healthy.
- [ ] Google Sign-In works from the Render frontend domain (Firebase authorized domain
      added).
- [ ] A live PesaPal payment completes end-to-end (submit → IPN → finalized) under the
      shared merchant, with a `GH-` merchant reference.
- [ ] The resulting `accounting_events` row reaches `sent`, and the hub's
      `ledger_ingest_events` shows it `posted` with `business = 'goalhub'`.
- [ ] Goalhub data (bookings, wallets, academy) intact after the DB cutover (row counts
      match the Supabase source; `alembic_version` at head).

---

## Appendix — how each area is enforced (for the reviewer)
- **Tagging/backfill:** migration 076 (`business` on 6 source tables; native ledger rows
  backfilled with the strict `business IS NULL AND source_system IS NULL` predicate).
- **Posting inheritance:** migration 077 (`post_journal_entry` derives business from the
  source document via `accounting_source_business`).
- **RBAC / read scoping:** migrations 078–080 (planned).
- **Write scoping:** migration 081 (planned).
