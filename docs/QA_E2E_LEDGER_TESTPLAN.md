# E2E Ledger Test Script — Expresswash Hub + Goalhub (pre-cutover sign-off)

Comprehensive, reproducible test script to prove the double-entry ledger and the
multi-business hub are production-ready **before** the Goalhub → Render cutover.
Covers Expresswash-native flows, multi-business RBAC, and the Goalhub→hub ingest
contract. 40+ checks. Everything runs locally against the Docker Supabase stack.

> Companion: `QA_MULTIBUSINESS_TESTPLAN.md` is the higher-level acceptance
> checklist; **this** doc is the step-by-step script with exact expected postings.

---

## 0. Environment, credentials & access

Both systems are already running. If a machine reboot stopped them, restart with the
commands in §0.4.

### 0.1 URLs
| What | URL |
|---|---|
| Hub web app (Expresswash) | http://localhost:8080 |
| Login page | http://localhost:8080/auth/signin |
| Accounts page | http://localhost:8080/admin/accounts |
| Supabase REST/RPC | http://127.0.0.1:54321/rest/v1 |
| Ingest RPC (Goalhub events) | http://127.0.0.1:54321/rest/v1/rpc/post_ingested_journal_entry |
| Postgres (verification) | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

### 0.2 Login credentials (password is the same for all three)
| Role | Email | Password | Expected access |
|---|---|---|---|
| super_admin | `super@ew.local` | `Passw0rd!` | Full multi-business (switcher, all businesses) |
| admin (regular) | `reg@ew.local` | `Passw0rd!` | Expresswash only (no switcher) |
| non-admin (customer) | `staff@ew.local` | `Passw0rd!` | Must NOT reach `/admin/accounts` |

### 0.3 Ingest secret (Goalhub simulation)
The ingest RPC requires the **`service_role` secret** (the only role allowed to call
it — exactly the boundary Goalhub's connector crosses). Get the local value from:
```bash
supabase status         # copy the value labelled "Secret" (starts with sb_secret_…)
export KEY="<paste the Secret value here>"
```
(Not committed to the repo — it's a secret-shaped string; read it live per session.)
> In production Goalhub POSTs `{source_system, event_type, …}` to the Edge Function
> `…/functions/v1/ledger-ingest` with `Authorization: Bearer <LEDGER_INGEST_SECRET>`.
> The Edge Function is a thin wrapper around the `post_ingested_journal_entry` RPC.
> Locally we call that RPC directly (params are `p_`-prefixed). The ledger postings
> are identical — this is the true integration contract.

### 0.4 (Re)start the systems if needed
```bash
cd /Users/nathanngethe/Documents/WorkProjects/Expresswash-ke
supabase start -x studio,logflare,vector,edge-runtime,imgproxy,inbucket,realtime,storage-api,supavisor,pooler
npm run dev            # serves on http://localhost:8080
```
To return to the clean baseline used by this script (drops all test data, re-seeds
COA + businesses, keeps migrations), see §7 "Reset & re-seed".

---

## 1. Verification helpers (keep a psql session open)

Open a verification shell:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

**Act as a role** (needed only for RPCs that check the caller; raw table SELECTs below
run as `postgres` and bypass RLS so you always see everything):
```sql
-- become super_admin for this session
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM auth.users WHERE email='super@ew.local'),false);
-- become regular admin
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM auth.users WHERE email='reg@ew.local'),false);
```

**H1 — show a journal entry's lines by memo** (the core check for every flow):
```sql
SELECT e.entry_number, e.source_type, e.business, e.status, coa.code, coa.name, l.debit, l.credit
FROM ledger_journal_entries e
JOIN ledger_journal_lines l ON l.journal_entry_id = e.id
JOIN chart_of_accounts coa ON coa.id = l.account_id
WHERE e.memo ILIKE '%<PUT MEMO SNIPPET>%'
ORDER BY e.created_at DESC, coa.code;
```

**H2 — trial balance (global integrity; must be 0.00):**
```sql
SELECT ROUND(SUM(l.debit),2) total_debit, ROUND(SUM(l.credit),2) total_credit,
       ROUND(SUM(l.debit)-SUM(l.credit),2) AS should_be_zero
FROM ledger_journal_lines l JOIN ledger_journal_entries e ON e.id=l.journal_entry_id
WHERE e.status='posted';
```

**H3 — every entry balances (returns 0 rows if healthy):**
```sql
SELECT e.entry_number, ROUND(SUM(l.debit)-SUM(l.credit),2) AS imbalance
FROM ledger_journal_entries e JOIN ledger_journal_lines l ON l.journal_entry_id=e.id
WHERE e.status='posted'
GROUP BY e.entry_number HAVING ROUND(SUM(l.debit)-SUM(l.credit),2) <> 0;
```

**H4 — per-business balances (as a set-returning function; needs a super_admin session):**
```sql
SELECT * FROM get_ledger_account_balances('goalhub')     WHERE balance <> 0 ORDER BY code;
SELECT * FROM get_ledger_account_balances('expresswash') WHERE balance <> 0 ORDER BY code;
SELECT (get_ledger_profit_and_loss('2020-01-01','2030-01-01','expresswash')->>'net_profit')::numeric AS ew_net,
       (get_ledger_profit_and_loss('2020-01-01','2030-01-01','goalhub')->>'net_profit')::numeric AS gh_net,
       (get_ledger_profit_and_loss('2020-01-01','2030-01-01',NULL)->>'net_profit')::numeric AS consolidated_net;
```

**H5 — one-time test contacts** (run once before Part A):
```sql
INSERT INTO contacts (id, name, contact_type, active, email, phone) VALUES
 ('11111111-1111-1111-1111-111111111111','Acme Customer','customer',true,'acme@test.local','0700000001'),
 ('22222222-2222-2222-2222-222222222222','Bolt Supplies','supplier',true,'bolt@test.local','0700000002')
ON CONFLICT (id) DO NOTHING;
```

### Reference: expected postings by flow (from the migrations)
| Flow | Debit | Credit |
|---|---|---|
| Invoice posted | AR (1100) = total | Sales (4000) = subtotal; VAT Payable (2100) = tax |
| Invoice payment | Cash by method (M-Pesa 1020 / Cash 1000 / Bank 1010) | AR (1100) = allocated; Customer Credits (2200) = unapplied |
| Bill posted | Expense (5000–5090) + Input VAT (1200) | AP (2000) = total |
| Bill payment | AP (2000) | Cash by method |
| Credit note | Sales (4000) = subtotal; VAT Payable (2100) = tax | AR (1100) = total |
| Expense posted | Expense by category | Cash by method |
| Customer refund | AR (1100) | Cash by method |
| Allocation (apply credit) | Customer Credits (2200) | AR (1100) |
| Goalhub booking_payment | M-Pesa-Goalhub (1021) | Turf Revenue (4100) |
| Goalhub wallet_topup | M-Pesa-Goalhub (1021) | Customer Wallet-Goalhub (2210) |
| Goalhub wallet_redemption | Customer Wallet-Goalhub (2210) | Turf Revenue (4100) |
| Goalhub refund | Turf Revenue (4100) | Customer Wallet-Goalhub (2210) |
| Goalhub cancellation_fee | M-Pesa-Goalhub (1021) | Turf Cancellation Fees (4110) |
| Goalhub fine_payment_cash | M-Pesa-Goalhub (1021) | Fine Income (4120) |
| Goalhub fine_payment_credit | Customer Wallet-Goalhub (2210) | Fine Income (4120) |
| Goalhub enrollment_payment | M-Pesa-Goalhub (1021) | Academy Revenue (4130) |

Payment-method → cash account: `mpesa`/`m-pesa`/`mobile_money`/`qr_code` → M-Pesa (1020);
`cash` → Cash (1000); `bank_transfer`/`card`/other → Bank (1010).

---

## PART A — Expresswash native ledger flows (RPC-level, exact postings)

Run these in a psql session that is **super_admin** (§1) after running H5.
Each path: run the call, then verify with H1 (and H3 for balance).

### A1 — Create & post an invoice with VAT
```sql
SELECT create_invoice_with_lines(
  '11111111-1111-1111-1111-111111111111', CURRENT_DATE, CURRENT_DATE,
  'A1 invoice',
  jsonb_build_array(jsonb_build_object('description','Deep clean','quantity',1,'unit_price',10000,'tax_amount',1600)),
  'pending', true, 'expresswash');
```
**Expected** (H1 on `A1 invoice` → but memo is on the ledger entry "Invoice posted: INV-…"; use `Invoice posted`):
- DR **Accounts Receivable (1100) 11,600**
- CR **Sales Revenue (4000) 10,000**
- CR **VAT Payable (2100) 1,600**
- `business = expresswash`; entry balances (H3).

### A2 — Record an invoice payment (M-Pesa, exact)
Get the invoice id: `SELECT id, balance FROM invoices WHERE notes='A1 invoice';`
```sql
SELECT record_invoice_payment('<invoice_id>', 11600, 'mpesa');
```
**Expected** (H1 on `Payment received`): DR **M-Pesa (1020) 11,600** / CR **Accounts Receivable (1100) 11,600**.
Invoice now `paid` (`SELECT status, balance FROM invoices WHERE id='<invoice_id>';` → paid, 0).

### A3 — Overpayment creates a customer credit
New invoice for 5,000, pay 6,000:
```sql
SELECT create_invoice_with_lines('11111111-1111-1111-1111-111111111111',CURRENT_DATE,CURRENT_DATE,'A3 invoice',
  jsonb_build_array(jsonb_build_object('description','Sofa','quantity',1,'unit_price',5000)), 'pending', true, 'expresswash');
-- then, with the new invoice id:
SELECT record_invoice_payment('<invoice_id>', 6000, 'mpesa');
```
**Expected**: DR M-Pesa 6,000 / CR AR 5,000 / CR **Customer Credits (2200) 1,000**. H3 balances.

### A4 — Create & post a bill with input VAT
```sql
SELECT create_bill_with_lines('22222222-2222-2222-2222-222222222222',CURRENT_DATE,CURRENT_DATE,'A4 bill',
  jsonb_build_array(jsonb_build_object('description','Detergent','quantity',1,'unit_price',5000,'tax_amount',800,
    'expense_account_id',(SELECT id FROM chart_of_accounts WHERE system_key='cleaning_supplies'))),
  true, 'expresswash');
```
**Expected** (H1 on `Bill posted`): DR **Cleaning Supplies (5000) 5,000** / DR **Input VAT (1200) 800** / CR **Accounts Payable (2000) 5,800**.

### A5 — Pay the bill (bank transfer)
`SELECT id FROM bills WHERE notes='A4 bill';`
```sql
SELECT record_bill_payment('<bill_id>', 5800, 'bank_transfer');
```
**Expected** (H1 on `Payment made`): DR **Accounts Payable (2000) 5,800** / CR **Bank (1010) 5,800**.

### A6 — Credit note against an invoice
Use the A1 invoice id:
```sql
SELECT create_credit_note_for_invoice('<A1_invoice_id>', 2900, 'Partial credit');
```
**Expected** (H1 on `Credit note posted`): DR **Sales Revenue (4000) 2,500** / DR **VAT Payable (2100) 400** (proportional) / CR **Accounts Receivable (1100) 2,900**. *(Exact VAT split depends on the credit amount; confirm debits = credit = 2,900 and it balances.)*

### A7 — Record an expense (category → account, cash)
```sql
INSERT INTO expenses (category, amount, description, payment_method, expense_date, status, created_by, business)
VALUES ('supplies', 500, 'A7 mops', 'cash', CURRENT_DATE, 'approved',
        (SELECT id FROM auth.users WHERE email='super@ew.local'), 'expresswash')
RETURNING id;
-- post it to the ledger:
SELECT post_expense_to_ledger('<expense_id>');
```
**Expected** (H1 on `A7 mops`): DR **Cleaning Supplies (5000) 500** / CR **Cash (1000) 500**. `business=expresswash`.

### A8 — Customer refund
Refund 1,000 against the A3 payment (find it: `SELECT id FROM payments WHERE notes IS NULL AND amount=6000 ORDER BY created_at DESC LIMIT 1;` or by invoice):
```sql
SELECT record_customer_refund('<A3_invoice_id>', '<A3_payment_id>', 1000, 'mpesa');
```
**Expected** (H1 on `Customer refund`): DR **Accounts Receivable (1100) 1,000** / CR **M-Pesa (1020) 1,000**. `business=expresswash` (via the manual_adjustment→source resolution).

### A9 — Manual journal entry (custom balanced entry)
```sql
SELECT post_journal_entry('manual_adjustment', NULL, CURRENT_DATE, 'A9 owner top-up',
  jsonb_build_array(
    jsonb_build_object('account_id',(SELECT id FROM chart_of_accounts WHERE system_key='bank'),'debit',20000,'credit',0),
    jsonb_build_object('account_id',(SELECT id FROM chart_of_accounts WHERE system_key='owner_equity'),'debit',0,'credit',20000)),
  'expresswash');
```
**Expected**: DR Bank (1010) 20,000 / CR Owner Equity (3000) 20,000. `business=expresswash` (explicit).

### A10 — Reverse a journal entry
Reverse the A9 entry:
```sql
SELECT id, entry_number FROM ledger_journal_entries WHERE memo='A9 owner top-up';
SELECT reverse_journal_entry('<A9_entry_id>', CURRENT_DATE, 'Reverse A9');
```
**Expected**: a new entry with **mirrored** lines (DR Owner Equity 20,000 / CR Bank 20,000), `business=expresswash` (inherited from the original), and the original row now `status='reversed'`:
```sql
SELECT entry_number, status, business FROM ledger_journal_entries WHERE memo IN ('A9 owner top-up','Reverse A9');
```

### A11 — Idempotency of native posting (no double-post)
Re-post the A1 invoice:
```sql
SELECT post_invoice_to_ledger('<A1_invoice_id>');   -- returns idempotent/no new entry
SELECT count(*) FROM ledger_journal_entries WHERE source_type='invoice' AND source_id='<A1_invoice_id>';  -- expect 1
```

### A12 — Global integrity after Part A
Run **H2** (should_be_zero = 0.00) and **H3** (0 rows). ✅ trial balance holds.

---

## PART B — Multi-business & RBAC (RPC-level)

### B1 — super_admin creates a **Goalhub** invoice
As super_admin:
```sql
SELECT create_invoice_with_lines('11111111-1111-1111-1111-111111111111',CURRENT_DATE,CURRENT_DATE,'B1 goalhub inv',
  jsonb_build_array(jsonb_build_object('description','GH item','quantity',1,'unit_price',3000)), 'pending', true, 'goalhub');
```
**Expected**: invoice + its ledger entry tagged `business='goalhub'`:
```sql
SELECT business FROM invoices WHERE notes='B1 goalhub inv';                          -- goalhub
SELECT business FROM ledger_journal_entries WHERE source_type='invoice'
  AND source_id=(SELECT id FROM invoices WHERE notes='B1 goalhub inv');              -- goalhub
```

### B2 — regular admin is Expresswash-only
Switch session to **regular admin** (§1), then:
```sql
-- requesting goalhub must fail:
SELECT create_invoice_with_lines('11111111-1111-1111-1111-111111111111',CURRENT_DATE,CURRENT_DATE,'B2 blocked',
  jsonb_build_array(jsonb_build_object('description','x','quantity',1,'unit_price',100)), 'pending', false, 'goalhub');
```
**Expected**: `{"success": false, "error": "... Not authorized to write business goalhub ..."}` (no invoice created).
```sql
-- default → expresswash:
SELECT create_invoice_with_lines('11111111-1111-1111-1111-111111111111',CURRENT_DATE,CURRENT_DATE,'B2 ok',
  jsonb_build_array(jsonb_build_object('description','x','quantity',1,'unit_price',100)), 'pending', false, NULL);
SELECT business FROM invoices WHERE notes='B2 ok';   -- expresswash
```

### B3 — Per-business reports & reconciliation
Back to super_admin, run **H4**. **Expected**: `expresswash net + goalhub net = consolidated net` exactly. Also:
```sql
-- regular admin requesting goalhub report must RAISE:
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM auth.users WHERE email='reg@ew.local'),false);
SELECT get_ledger_profit_and_loss('2020-01-01','2030-01-01','goalhub');   -- ERROR: Not authorized for business goalhub
```

### B4 — Direct-table isolation (RLS) for a regular admin
```sql
SET LOCAL ROLE authenticated;   -- inside a BEGIN; … block; RLS now applies
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM auth.users WHERE email='reg@ew.local'),true);
SELECT count(*) FILTER (WHERE business='goalhub') AS goalhub_visible,
       count(*) FILTER (WHERE business='expresswash') AS expresswash_visible
FROM ledger_journal_entries;   -- expect goalhub_visible = 0
RESET ROLE;
```

### B5 — Cross-business allocation is blocked
```sql
-- try allocating a goalhub payment to an expresswash invoice via a direct allocation insert:
-- (create a goalhub invoice+payment first if needed) — expect a check_violation error.
```
*(Covered structurally by the `payment_allocations` guard trigger; the SQL suite
`/tmp/verify_b3.sql` demonstrates it programmatically.)*

### B6 — The `ledger_account_balances` leak is closed
```sql
-- as the authenticated role the raw view must be denied:
SELECT has_table_privilege('authenticated','ledger_account_balances','SELECT');   -- false
SELECT has_function_privilege('authenticated','get_ledger_account_balances(text)','EXECUTE'); -- true
```

---

## PART C — Goalhub → hub ingest (simulate the connector over HTTP)

Reusable curl (fill EVENT/EXTID/AMOUNT). This is exactly the payload Goalhub's
dispatcher builds, mapped to the RPC params:
```bash
INGEST=http://127.0.0.1:54321/rest/v1/rpc/post_ingested_journal_entry
# KEY must already be exported from `supabase status` (see §0.3)
post_event () {  # $1=event_type $2=external_id $3=amount [$4=provider]
  curl -s -X POST "$INGEST" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d "{\"p_source_system\":\"goalhub\",\"p_event_type\":\"$1\",\"p_external_id\":\"$2\",\"p_amount\":$3,\"p_business\":\"goalhub\",\"p_provider\":\"${4:-mpesa}\"}"; echo
}
```
Verify each with H1 (memo = the event's description template) or:
```sql
SELECT e.external_id, coa.code, coa.name, l.debit, l.credit, e.business
FROM ledger_ingest_events ie
JOIN ledger_journal_entries e ON e.id = ie.journal_entry_id
JOIN ledger_journal_lines l ON l.journal_entry_id = e.id
JOIN chart_of_accounts coa ON coa.id = l.account_id
WHERE ie.external_id = '<EXTID>' ORDER BY coa.code;
```

| # | Command | Expected posting (DR / CR), business=goalhub |
|---|---|---|
| C1 | `post_event booking_payment payment:1001 2400 mpesa` | DR M-Pesa-Goalhub (1021) / CR Turf Revenue (4100) 2,400 |
| C2 | `post_event wallet_topup payment:1002 1500 pesapal` | DR M-Pesa-Goalhub (1021) / CR Customer Wallet-Goalhub (2210) 1,500 |
| C3 | `post_event wallet_redemption redemption:2001 800 credit` | DR Customer Wallet-Goalhub (2210) / CR Turf Revenue (4100) 800 |
| C4 | `post_event refund refund:3001 500 credit` | DR Turf Revenue (4100) / CR Customer Wallet-Goalhub (2210) 500 |
| C5 | `post_event cancellation_fee payment:1003 300 mpesa` | DR M-Pesa-Goalhub (1021) / CR Turf Cancellation Fees (4110) 300 |
| C6 | `post_event fine_payment_cash fine:4001 200 cash` | DR M-Pesa-Goalhub (1021) / CR Fine Income (4120) 200 |
| C7 | `post_event fine_payment_credit fine:4002 200 credit` | DR Customer Wallet-Goalhub (2210) / CR Fine Income (4120) 200 |
| C8 | `post_event enrollment_payment payment:1004 3500 mpesa` | DR M-Pesa-Goalhub (1021) / CR Academy Revenue (4130) 3,500 |

> C5 (cancellation_fee) and C8 (enrollment_payment) validate hub **mappings** that
> exist today; Goalhub's connector currently defers emitting those two (fee is retained
> as revenue; enrollment finalization is deferred). Testing them here future-proofs the hub.

### C9 — Idempotency (the dedup boundary)
Re-run **C1 verbatim**. **Expected**: `{"success": true, "idempotent": true, "journal_entry_id": "<same id as C1>"}` and:
```sql
SELECT count(*) FROM ledger_journal_entries WHERE external_id='payment:1001';   -- still 1
```

### C10 — Bad mapping is recorded, not posted
```bash
post_event no_such_event payment:9999 100 mpesa
```
**Expected**: `{"success": false, "error": "No active mapping for (goalhub, no_such_event)"}`, no journal entry, and a `failed` inbox row:
```sql
SELECT status, error_message FROM ledger_ingest_events WHERE external_id='payment:9999';  -- failed
```

### C11 — Goalhub totals land in the hub's Goalhub scope
Run **H4** for goalhub. **Expected exact balances** (from C1–C8, verified):

| Account | Balance | Derivation |
|---|---|---|
| 4100 Turf Revenue | **2,700** | booking 2,400 + redemption 800 − refund 500 |
| 4110 Turf Cancellation Fees | **300** | cancellation_fee 300 |
| 4120 Fine Income | **400** | fine cash 200 + fine credit 200 |
| 4130 Academy Revenue | **3,500** | enrollment 3,500 |
| 1021 M-Pesa - Goalhub | **7,900** | 2,400 + 1,500 + 300 + 200 + 3,500 |
| 2210 Customer Wallet - Goalhub | **1,000** | topup 1,500 − redemption 800 + refund 500 − fine credit 200 |

Goalhub P&L **net = 6,900** (income 6,900, no goalhub expenses). H3 → 0 imbalances.

---

## PART D — UI walkthrough (browser / chrome-mcp)

Log in at http://localhost:8080/auth/signin. Do the whole part for **super@ew.local**,
then repeat the RBAC checks for **reg@ew.local** and **staff@ew.local**.

### D1 — super_admin sees the switcher
Go to `/admin/accounts`. **Expect**: a business dropdown in the header showing
"All businesses (consolidated) / Expresswash / Goalhub" + an "Add business" (+) button.

### D2 — Scope switches the numbers
Select **Expresswash** → note P&L Net. Select **Goalhub** → P&L should show Turf Revenue
and the goalhub totals from Part C (income ≈ 2,700 + 300 + 400 + 3,500), Expresswash
accounts show 0. Select **All businesses** → totals are the **sum** of the two, and
**Bill / Add Expense / Journal Entry buttons are disabled** (Contact stays enabled).

### D3 — Create a Bill via the UI (business-tagged)
Select **Goalhub**, click **Bill**, pick supplier "Bolt Supplies", add a line, save.
**Expect**: success; then verify `SELECT business FROM bills ORDER BY created_at DESC LIMIT 1;` → `goalhub`.
Repeat with **Expresswash** selected → `expresswash`.

### D4 — Create an Expense via the UI (business-tagged)
Select **Expresswash**, click **Add Expense**, fill it, save. Verify the newest
`expenses` row has `business='expresswash'`. Switch to **Goalhub**, add another →
`goalhub`.

### D5 — Add a new business
As super_admin click the **+** next to the switcher, add e.g. name "Test Biz" slug
`testbiz`. **Expect**: toast success, the switcher now lists "Test Biz", and:
```sql
SELECT slug,name,active FROM businesses WHERE slug='testbiz';
```

### D6 — Regular admin has no switcher
Log in as **reg@ew.local** → `/admin/accounts`. **Expect**: a static "Expresswash"
label (no dropdown, no + button); reports show Expresswash figures only; the Journal
Entries list shows **no Goalhub `IJE-…` rows** (RLS-filtered).

### D7 — Non-admin is blocked
Log in as **staff@ew.local**. **Expect**: cannot reach `/admin/accounts` (redirected /
denied). The Accounts admin area is not accessible.

### D8 — Reports render & balance (super_admin, consolidated)
On the Reports tab confirm: Balance Sheet shows **"Balanced"**; P&L Net = Income −
Expenses; Cash Flow, VAT, Receivables & Payables aging tabs load without error; browser
console has **no errors**.

---

## PART E — Global integrity & reconciliation (final gate)

Run all of these; every one must pass before sign-off.

- **E1** — H2 trial balance `should_be_zero = 0.00`.
- **E2** — H3 returns **0 rows** (every posted entry balances).
- **E3** — H4 reconciliation: `expresswash_net + goalhub_net = consolidated_net` (and the
  `testbiz`/others net to 0 if unused).
- **E4** — Idempotency holds for both native (A11) and ingest (C9): re-runs never
  create a second entry.
- **E5** — Isolation: as a regular admin (B4) `goalhub_visible = 0` at the table level,
  and `ledger_account_balances` is not directly readable by `authenticated` (B6).
- **E6** — Ingest provenance: `SELECT source_system, status, count(*) FROM
  ledger_ingest_events GROUP BY 1,2;` — all Part C successes are `posted`, C10 is `failed`,
  no `goalhub` event is untagged.

---

## 6. Sign-off checklist
- [ ] Part A (A1–A12) — all native postings match the expected DR/CR and balance.
- [ ] Part B (B1–B6) — multi-business writes/reads correctly RBAC-scoped; leak closed.
- [ ] Part C (C1–C11) — every Goalhub event posts to the right accounts; idempotent; bad-mapping handled.
- [ ] Part D (D1–D8) — UI switcher, scoping, consolidated write-lock, add-business, RBAC, no console errors.
- [ ] Part E (E1–E6) — trial balance zero, all entries balance, reconciliation holds, isolation verified.

When every box is ticked, the ledger + multi-business hub are production-ready and the
Goalhub → Render cutover can proceed.

---

## 7. Reset & re-seed (return to the clean baseline)
```bash
cd /Users/nathanngethe/Documents/WorkProjects/Expresswash-ke
supabase db reset            # drops data, re-runs migrations (COA + businesses re-seeded)
# recreate the three login users:
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous,confirmation_token,recovery_token,email_change_token_new,email_change)
SELECT '00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated',email,
       extensions.crypt('Passw0rd!',extensions.gen_salt('bf')),now(),now(),now(),
       '{"provider":"email","providers":["email"]}'::jsonb,meta,false,false,'','','',''
FROM (VALUES ('super@ew.local','{"role":"super_admin","name":"Super Admin"}'::jsonb),
             ('reg@ew.local','{"role":"admin","name":"Reg Admin"}'::jsonb),
             ('staff@ew.local','{"role":"customer","name":"Staff User"}'::jsonb)) v(email,meta);
INSERT INTO auth.identities (provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
SELECT u.email,u.id,jsonb_build_object('sub',u.id::text,'email',u.email,'email_verified',true),'email',now(),now(),now()
FROM auth.users u WHERE u.email LIKE '%@ew.local';
SQL
```
Then re-run H5 to recreate the test contacts. (`.env.local` already points the app at
the local stack; leave it in place.)
