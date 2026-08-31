# Pre-cutover ledger QA result — 2026-08-31

## Outcome

**FAIL — sign-off stopped at D8.** Parts A–C and D1–D7 passed, including the D2 and
D6 re-tests after commits `a8ab860` and `56de897`. Consolidated reports render and
reconcile, but the Payables & Bills tab still exposes enabled write controls while
"All businesses" is selected. The cutover is not signed off from this run.

The resumed run stopped on the first newly confirmed product failure. No migration or
application fix was applied. Part E was not run.

## Test-plan corrections made during the run

- A3 now uses the supported allocation workflow to create Customer Credits; direct
  single-invoice overpayment remains a correctly rejected operation.
- A6 now uses a dedicated open VAT invoice; the old sequence targeted A1 after A1 had
  been fully paid, making the prescribed credit note invalid by construction.
- C11 now distinguishes the KES 6,900 ingest contribution from the full Goalhub scope,
  which also contains native B1/B5 postings created earlier in the same script.

These were test-script sequencing/expectation defects. Ledger behavior remained
balanced throughout.

## Environment baseline: PASS

| Check | Expected | Actual |
|---|---:|---:|
| Hub `/auth/signin` | HTTP 200 | HTTP 200 |
| Supabase REST | HTTP 200 | HTTP 200 |
| Latest migration | 081 | `20260831000007` (081) |
| Journal entries / lines | 0 / 0 | 0 / 0 |
| Invoices / bills / expenses | 0 / 0 / 0 | 0 / 0 / 0 |
| Businesses / QA users | 2 / 3 | 2 / 3 |

## Part A — native ledger flows: PASS

| Check | Expected | Actual | Result |
|---|---|---|---|
| A1 invoice | DR 1100 11,600; CR 4000 10,000; CR 2100 1,600 | Exact match; expresswash; imbalance 0 | PASS |
| A2 invoice payment | DR 1020 11,600; CR 1100 11,600; paid / 0 | Exact match; paid / 0 | PASS |
| A3 customer credit | Net DR 1020 5,000; CR 1100 3,000; CR 2200 2,000 | Exact match; partial / 2,000; unapplied 2,000 | PASS |
| A4 bill | DR 5000 5,000; DR 1200 800; CR 2000 5,800 | Exact match | PASS |
| A5 bill payment | DR 2000 5,800; CR 1010 5,800 | Exact match; paid / 0 | PASS |
| A6 credit note | DR 4000 2,500; DR 2100 400; CR 1100 2,900 | Exact match; remaining balance 8,700 | PASS |
| A7 expense | DR 5000 500; CR 1000 500 | Exact match | PASS |
| A8 refund | DR 1100 1,000; CR 1020 1,000 | Exact match | PASS |
| A9 manual entry | DR 1010 20,000; CR 3000 20,000 | Exact match | PASS |
| A10 reversal | DR 3000 20,000; CR 1010 20,000; original reversed | Exact match | PASS |
| A11 native idempotency | One A1 invoice entry | Count 1; same journal ID | PASS |
| A12 integrity | H2 difference 0; H3 0 rows | 82,800 / 82,800 / 0; H3 0 rows | PASS |

The documented `notify_on_payment` warning appeared for test contacts without real app
profiles. It was caught and did not affect any payment or journal posting.

## Part B — multi-business and RBAC: PASS

| Check | Expected | Actual | Result |
|---|---|---|---|
| B1 Goalhub invoice | invoice + journal business `goalhub` | goalhub / goalhub | PASS |
| B2 blocked write | regular admin rejected for Goalhub | `Not authorized to write business goalhub`; no row | PASS |
| B2 default write | NULL defaults to Expresswash | expresswash | PASS |
| B3 reconciliation | EW + GH = consolidated | 17,000 + 3,000 = 20,000 | PASS |
| B3 report auth | regular admin Goalhub report raises | `Not authorized for business goalhub` | PASS |
| B4 table RLS | Goalhub visible 0 | Goalhub 0; Expresswash 13 | PASS |
| B5 cross allocation | check violation; zero cross rows | `Cannot allocate a goalhub payment to a expresswash invoice`; 0 | PASS |
| B6 leak closure | raw view false; scoped RPC true | false / true | PASS |

## Part C — Goalhub ingest contract: PASS

| Check | Expected DR / CR | Actual | Result |
|---|---|---|---|
| C1 booking | 1021 / 4100 2,400 | Exact match | PASS |
| C2 top-up | 1021 / 2210 1,500 | Exact match | PASS |
| C3 redemption | 2210 / 4100 800 | Exact match | PASS |
| C4 refund | 4100 / 2210 500 | Exact match | PASS |
| C5 cancellation | 1021 / 4110 300 | Exact match | PASS |
| C6 cash fine | 1021 / 4120 200 | Exact match | PASS |
| C7 credit fine | 2210 / 4120 200 | Exact match | PASS |
| C8 enrollment | 1021 / 4130 3,500 | Exact match | PASS |
| C9 replay | idempotent; same ID; count 1 | same ID; count 1 | PASS |
| C10 bad mapping | failed inbox; no journal | failed; exact error; 0 journals | PASS |
| C11 1021 | 7,900 | 7,900 | PASS |
| C11 2210 | 1,000 | 1,000 | PASS |
| C11 4100 / 4110 / 4120 / 4130 | 2,700 / 300 / 400 / 3,500 | Exact match | PASS |
| C11 ingest P&L | 6,900 | 6,900 | PASS |
| H3 after C | 0 rows | 0 rows | PASS |

The full Goalhub P&L was KES 10,000: KES 6,900 ingested plus KES 3,100 from native
B1/B5 test invoices.

## Part D — live Chrome UI

### D1 — super-admin switcher: PASS

Chrome showed exactly one switcher with All businesses (consolidated), Expresswash,
Goalhub, and an Add business button. The selected scope persisted across reload.

### D2 — scope switches all numbers: PASS after `a8ab860`

| Scope | Revenue | Expenses | Net | Outstanding | Actual / expected | Result |
|---|---:|---:|---:|---:|---|---|
| Expresswash | 32,500 | 5,900 | 26,600 | 20,800 | Exact; P&L and KPI cards match | PASS |
| Goalhub | 14,000 | 0 | 14,000 | 3,000 | Exact; P&L and KPI cards match | PASS |
| Consolidated | 46,500 | 5,900 | 40,600 | 23,800 | Exact sum of businesses | PASS |

The Expresswash journal panel contained no Goalhub ingest memos; the Goalhub panel
contained no Expresswash memos. Consolidated mode disabled Bill, Add Expense, and
Journal Entry while leaving Contact enabled. Chrome console errors: **0**.

### D3 — create business-tagged bills: PASS

| UI action | Expected | Actual | Result |
|---|---|---|---|
| Goalhub bill | KES 1,000; `business=goalhub` | `D3 Goalhub UI bill`; 1,000; goalhub | PASS |
| Expresswash bill | KES 1,200; `business=expresswash` | `D3 Expresswash UI bill`; 1,200; expresswash | PASS |

The success toasts were `Bill BILL-20260831-31D653 created` and
`Bill BILL-20260831-A5C32E created`. Both bills posted and remained isolated to the
selected business.

### D4 — create business-tagged expenses: PASS

| UI action | Expected business | Actual amount / business / status | Result |
|---|---|---|---|
| Expresswash expense | expresswash | KES 300 / expresswash / pending | PASS |
| Goalhub expense | goalhub | KES 400 / goalhub / pending | PASS |

Both UI submissions showed `Expense added`. Pending expenses correctly did not change
posted-ledger KPIs.

### D5 — add a business: PASS

The UI showed `Added Test Biz`; the switcher immediately listed exactly one Test Biz
option. Database actual: `testbiz | Test Biz | active=true`.

### D6 — regular admin has no switcher: PASS after `56de897`

Browser reproduction:

1. As `super@ew.local`, create Test Biz; the UI selects and persists `testbiz`.
2. Log out in the same Chrome session.
3. Sign in as `reg@ew.local` and navigate to `/admin/accounts`.

The role controls and effective scope were both correct: there was no business
combobox and no Add Business button, the header rendered the static label
`Expresswash`, and every query returned Expresswash data despite the persisted Test
Biz selection:

| Check | Expected | Actual | Result |
|---|---:|---:|---|
| Revenue | KES 32,500 | KES 32,500 | PASS |
| Expenses | KES 7,100 | KES 7,100 | PASS |
| Net | KES 25,400 | KES 25,400 | PASS |
| Outstanding | KES 20,800 | KES 20,800 | PASS |
| Business controls | 0 switchers / 0 Add Business | 0 / 0 | PASS |
| Journal entries | Expresswash rows; no Goalhub rows | 16 `JE-` / 0 `IJE-` | PASS |

Exact Chrome DOM excerpt:

```text
text: Expresswash
paragraph: Total Revenue
paragraph: KES 32,500
paragraph: Total Expenses
paragraph: KES 7,100
paragraph: Net Profit
paragraph: KES 25,400
paragraph: Outstanding
paragraph: KES 20,800
heading "Journal Entries"
paragraph: JE-20260831-C0E7217C
```

### D7 — non-admin blocked: PASS

As `staff@ew.local`, direct navigation to `/admin/accounts` redirected to `/`. The
Accounts admin layout and data were not rendered.

### D8 — reports render, but consolidated write-lock is incomplete: FAIL

The report checks passed:

| Check | Expected | Actual | Result |
|---|---:|---:|---|
| Consolidated P&L | income − expenses = net | 46,500 − 8,100 = 38,400 | PASS |
| Balance sheet | Balanced | Assets 26,400 = liabilities 8,000 + equity 18,400 | PASS |
| VAT | output / input / payable | 1,600 / 800 / 800 | PASS |
| Cash flow | inflows / outflows / net | 16,700 / 27,700 / -11,000 | PASS |
| Receivables aging | loads; current 23,800 | 23,800; overdue detail rendered | PASS |
| Payables aging | loads; current 2,200 | 2,200; three bill rows rendered | PASS |
| Console | 0 errors / 0 warnings | 0 / 0 | PASS |

The higher-level consolidated acceptance requirement failed. With `All businesses
(consolidated)` selected:

- The header Add Bill, Add Expense, and Journal Entry controls were disabled.
- The Payables & Bills tab rendered a second, enabled `Add Bill` button.
- Clicking that button opened the complete `Add Supplier Bill` write dialog.
- The two outstanding consolidated bill rows also rendered enabled `Pay` buttons.

Exact Chrome DOM excerpt after clicking the tab-level button:

```text
combobox: All businesses (consolidated)
button "Add Bill" [disabled]
tabpanel "Payables & Bills"
  button "Add Bill"
  button "Pay"
  button "Pay"
dialog "Add Supplier Bill"
  paragraph: Create an open payable and post it to the ledger.
  button "Create Bill"
```

### D8 diagnosis

`Accounts.tsx:856` correctly applies `disabled={isConsolidated}` to the header Add
Bill button. The duplicate Payables-tab button at `Accounts.tsx:1096` calls
`setAddBillOpen(true)` without the same guard. The dialog's Create Bill action later
passes `selectedBusiness` as `businessId`; under consolidated scope that value is not
a concrete business. The tab-level Add Bill control must use the same disabled state
and explanation as the header. The Pay controls should also follow the documented
consolidated write policy or explicitly switch/drill into the bill's business before
allowing payment.

### Senior UI/UX polish re-test after `919e96a`: PASS

- Operational sales widgets are hidden for Goalhub and Test Biz and remain available
  for Expresswash/consolidated.
- Expense success copy now states `pending approval`.
- The Add Business dialog has an accessible description; Chrome logged no warnings.
- The header action is consistently labelled `Add Bill`.

## Not run after the D8 stop

- E1–E6 and the §6 final sign-off checklist

Diagnostic integrity at the stop point remained healthy: H2 actual debit and credit
were both KES 112,000.00, difference KES 0.00; H3 returned zero rows.
