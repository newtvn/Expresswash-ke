# Pre-cutover ledger QA result — 2026-08-31

## Outcome

**FAIL — sign-off stopped at D2.** Parts A–C and D1 passed. The detailed Goalhub
ledger reports re-scoped correctly, but the four Accounts KPI cards and the journal
entry list did not follow the selected business. The cutover is not signed off from
this run.

The run stopped on the first confirmed product failure. No migration or application
fix was applied. D3–D8 and Part E were not run.

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

Chrome showed exactly one switcher with:

- All businesses (consolidated)
- Expresswash
- Goalhub
- Add business button

### D2 — scope switches all numbers: FAIL

The detailed reports did switch successfully:

| Report | Expected | Actual | Result |
|---|---:|---:|---|
| Expresswash P&L income / expense / net | 22,500 / 5,500 / 17,000 | 22,500 / 5,500 / 17,000 | PASS |
| Goalhub P&L income / expense / net | 10,000 / 0 / 10,000 | 10,000 / 0 / 10,000 | PASS |
| Goalhub balance sheet | Balanced | Balanced | PASS |
| Goalhub ingest accounts | 1021 7,900; 2210 1,000; income 6,900 | Exact values rendered | PASS |

But after selecting Goalhub and waiting two seconds, the summary cards remained the
unscoped combined operational values:

| KPI | Expresswash expected | Goalhub expected | Actual while Goalhub selected | Result |
|---|---:|---:|---:|---|
| Total Revenue | 16,600 | 100 | 16,700 | FAIL |
| Total Expenses | 500 | 0 | 500 | FAIL |
| Net Profit | 16,100 | 100 | 16,200 | FAIL |
| Outstanding | -16,600 | -100 | -16,700 | FAIL |

The Journal Entries panel also remained unscoped: while Goalhub was selected, it
rendered Expresswash `JE-…` rows alongside Goalhub `IJE-…` rows. Database counts at
that point were 12 posted Expresswash entries and 11 posted Goalhub entries.

Chrome console errors: **0**.

### Diagnosis

`Accounts.tsx` keys the ledger report queries by `selectedBusiness`, so the detailed
reports refetch correctly. The KPI query is instead fixed at `['accounts','summary']`;
`fetchAccountSummary()` reads all `payments` and `expenses` without a business filter.
It therefore never refetches or re-scopes when the switcher changes.

The journal list has the same gap: `getLedgerOverview(business)` passes the business to
`listAccountBalances(business)` but calls `listJournalEntries()` without it. A
super-admin consequently receives all businesses' rows in every selected scope.

## Not run after the D2 stop

- D3–D8
- E1–E6 and the §6 final sign-off checklist

Diagnostic integrity at the stop point remained healthy: posted debit and credit were
both KES 95,400.00, difference KES 0.00; the most recent H3 returned zero rows.
