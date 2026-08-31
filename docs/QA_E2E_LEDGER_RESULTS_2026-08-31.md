# Pre-cutover ledger QA result — 2026-08-31

## Outcome

**FAIL — sign-off stopped at A3.** The ledger is not signed off as production-ready,
and the Goalhub → Render cutover must not proceed from this run.

The run followed `QA_E2E_LEDGER_TESTPLAN.md` and stopped at the first failed check,
as required. No migration or application fix was applied. Parts A4–E were not run.

## Environment baseline

| Check | Expected | Actual | Result |
|---|---:|---:|---|
| Hub `/auth/signin` | HTTP 200 | HTTP 200 | PASS |
| Supabase REST | HTTP 200 | HTTP 200 | PASS |
| Latest migration | 081 | `20260831000007` (081) | PASS |
| Journal entries / lines | 0 / 0 | 0 / 0 | PASS |
| Invoices / bills / expenses | 0 / 0 / 0 | 0 / 0 / 0 | PASS |
| Businesses / QA users | 2 / 3 | 2 / 3 | PASS |

## Executed checks

### A1 — invoice with VAT: PASS

| Posting/scope | Expected | Actual |
|---|---:|---:|
| DR Accounts Receivable (1100) | 11,600.00 | 11,600.00 |
| CR Sales Revenue (4000) | 10,000.00 | 10,000.00 |
| CR VAT Payable (2100) | 1,600.00 | 1,600.00 |
| Entry debit / credit / imbalance | 11,600.00 / 11,600.00 / 0.00 | 11,600.00 / 11,600.00 / 0.00 |
| Business / entry status | expresswash / posted | expresswash / posted |

RPC result included `"success": true`, invoice ID
`182dbcf6-2b4a-4f8d-8aa3-56563ff0e92b`, and journal entry ID
`b70f012a-45cc-4afd-bc6c-887fd164d8d2`.

### A2 — exact M-Pesa invoice payment: PASS

| Posting/state | Expected | Actual |
|---|---:|---:|
| DR M-Pesa (1020) | 11,600.00 | 11,600.00 |
| CR Accounts Receivable (1100) | 11,600.00 | 11,600.00 |
| Invoice status / balance | paid / 0.00 | paid / 0.00 |
| Business | expresswash | expresswash |

The database emitted this non-fatal warning while recording the payment:

```text
WARNING: notify_on_payment skipped for payment 6ee862a9-0a59-4e73-bf8d-5c2dcedeb926:
null value in column "recipient_id" of relation "notification_history" violates not-null constraint
```

The accounting operation still returned `"success": true` and posted a balanced
`payment_received` journal entry.

### A3 — overpayment creates customer credit: FAIL

Invoice creation succeeded and posted DR Accounts Receivable / CR Sales Revenue of
KES 5,000.00. The prescribed payment call then failed.

Exact command:

```sql
SELECT record_invoice_payment(
  'b07509e4-8827-4aa6-a394-5ac2f407ec19',
  6000,
  'mpesa'
);
```

Exact RPC output:

```json
{"error": "Payment amount 6000 exceeds invoice balance 5000.00", "success": false}
```

| Posting/state | Expected | Actual |
|---|---:|---:|
| DR M-Pesa (1020) | 6,000.00 | no payment journal entry |
| CR Accounts Receivable (1100) | 5,000.00 | no payment journal entry |
| CR Customer Credits (2200) | 1,000.00 | no payment journal entry |
| Payment row | created for 6,000.00 | no row created |
| Invoice status / balance | paid / 0.00, with 1,000.00 customer credit | pending / 5,000.00 |

## Diagnosis

The live six-argument `record_invoice_payment` function contains this guard, sourced
from migration 063 (`20260624000002_063_invoice_payment_credit_balance.sql`):

```sql
IF ROUND(p_amount, 2) > v_current_balance THEN
  RAISE EXCEPTION 'Payment amount % exceeds invoice balance %', p_amount, v_current_balance;
END IF;
```

That guard makes the A3 contract unreachable through the RPC named by the test plan.
Migration 069's `post_payment_received_to_ledger` does support splitting a payment
between allocated Accounts Receivable and unapplied Customer Credits, but
`record_invoice_payment` rejects the overpayment before it can create and post that
payment. This is an implementation/acceptance-contract mismatch, not an arithmetic
imbalance.

After the failure, the entries that had been created remained healthy:

| Integrity query | Expected | Actual | Result |
|---|---:|---:|---|
| H2 total debit / credit / difference | equal / equal / 0.00 | 28,200.00 / 28,200.00 / 0.00 | PASS |
| H3 imbalanced posted entries | 0 rows | 0 rows | PASS |

## Not run because of stop-on-first-failure

- A4–A12
- B1–B6
- C1–C11
- D1–D8 (Chrome UI walkthrough)
- E1–E6 and the §6 final sign-off checklist

The local database intentionally retains the A1–A3 diagnostic state. Use §7 of
`QA_E2E_LEDGER_TESTPLAN.md` before a fresh full rerun.
