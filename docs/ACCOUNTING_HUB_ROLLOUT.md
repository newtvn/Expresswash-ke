# Accounting Hub Rollout Runbook

Making **Expresswash the single source of truth** for the group's finances (a
"global Zoho", one shared set of books). Code is 100% merged; this is the
end-to-end deploy + verification checklist.

- **Hub (source of truth):** Expresswash-ke — Supabase/Postgres double-entry ledger. Merged in PR #58.
- **Source app #1:** Goalhub — FastAPI/Postgres. Pushes financial events to the hub. Merged in PR #35.
- **Transport:** Goalhub outbox → real-time webhook → hub `ledger-ingest` Edge Function → `post_ingested_journal_entry` RPC → journal entry.
- **Model:** one shared chart of accounts, per-business income/asset/liability accounts + a `business` tag. Idempotent on `(source_system, external_id)`.

> Separate Supabase projects — there is **no shared database**. Integration is app-to-app over HTTPS with a shared secret.

---

## Status (2026-08-18)

- ✅ **Hub deployed and verified** (Section 1 complete). ExpressWash project `bsmlzvenkeumebfbpsab`.
  - Migrations 072–074 applied (via SQL editor).
  - `LEDGER_INGEST_SECRET` generated and set as a Supabase secret.
  - `ledger-ingest` Edge Function deployed with `--no-verify-jwt`.
  - Smoke test passed against production: post → `success`, replay → `idempotent`, wrong secret → `401`, unknown event → `422`.
  - Function URL: `https://bsmlzvenkeumebfbpsab.supabase.co/functions/v1/ledger-ingest`
  - ⚠️ Leftover test entry `external_id=smoke-001` (KES 1,500 Turf Revenue) — reverse it via **/admin/accounts**.
- ⏭️ **Next: Section 2 — deploy the Goalhub connector** using the secret above.
- ⏭️ Then Section 3 (end-to-end) and Section 4 (reconciliation).

---

## 0. Prerequisites
- [ ] Supabase CLI logged in and linked to the **Expresswash** project (`supabase link --project-ref <EW_REF>`).
- [ ] Access to Goalhub's deploy env (Render) and its database for `alembic upgrade`.
- [ ] Ability to set env/secrets in both projects.

---

## 1. Deploy the Hub (Expresswash) — ✅ DONE

1. **Apply migrations** (072 chart-of-accounts + mapping, 073 pipeline/RPC, 074 fine mappings).
   Applied via the Supabase **SQL editor**, not the CLI — so the CLI migration
   history doesn't record them. Optional housekeeping so a future `supabase db push`
   doesn't try to re-run them:
   ```bash
   cd Expresswash-ke
   supabase migration repair --status applied 20260818000001 20260818000002 20260818000003
   ```
2. **Generate + set the shared ingest secret** (save this value — Goalhub needs the same one):
   ```bash
   openssl rand -hex 32          # copy the output
   supabase secrets set LEDGER_INGEST_SECRET="<paste-the-value>"
   ```
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` already exist for the other functions.
3. **Deploy the Edge Function** — it does its own secret auth, so JWT verification must be OFF:
   ```bash
   supabase functions deploy ledger-ingest --no-verify-jwt
   ```
4. **Smoke-test** (replace `<EW_REF>` and the secret):
   ```bash
   curl -X POST https://<EW_REF>.supabase.co/functions/v1/ledger-ingest \
     -H "Authorization: Bearer <LEDGER_INGEST_SECRET>" \
     -H "Content-Type: application/json" \
     -d '{"source_system":"goalhub","event_type":"booking_payment","external_id":"smoke-001","amount":1500}'
   ```
   - Expect `{"success":true,"idempotent":false,"journal_entry_id":"..."}`.
   - Run it **again** → `"idempotent":true`, same id (proves idempotency).
   - Verify: a row in `ledger_ingest_events` (`status='posted'`) and a balanced entry in `ledger_journal_entries` (visible under **/admin/accounts**).
   - Clean up the smoke entry afterward (or leave it and reverse via the admin UI).

---

## 2. Deploy the Source Connector (Goalhub) — ⏭️ NEXT

1. **Run the migration** (creates `accounting_events` outbox):
   ```bash
   cd Goalhub/backend
   alembic upgrade head          # applies i1a2b3c4d5e6
   ```
2. **Set env vars** (Render dashboard or `.env`) — the URL and secret below are the
   live hub values; `LEDGER_INGEST_SECRET` must exactly match the hub's secret:
   ```
   LEDGER_INGEST_ENABLED=true
   LEDGER_INGEST_URL=https://bsmlzvenkeumebfbpsab.supabase.co/functions/v1/ledger-ingest
   LEDGER_INGEST_SECRET=<the value generated in step 1.2 — retrieve from your records>
   ACCOUNTING_SOURCE_SYSTEM=goalhub
   ACCOUNTING_BUSINESS=goalhub
   # optional tuning:
   # LEDGER_DISPATCH_INTERVAL_SECONDS=30
   # LEDGER_DISPATCH_BATCH_SIZE=25
   ```
   > The secret is stored only in the hub's Supabase secrets (write-only) — keep the
   > copy you saved when it was generated. If lost, regenerate on the hub
   > (`supabase secrets set LEDGER_INGEST_SECRET=...`) and update both sides.
3. **Redeploy** the FastAPI service. On boot the logs should show
   `📒 Accounting dispatcher started (interval=30s, enabled=True)`.

> Leaving `LEDGER_INGEST_ENABLED=false` is safe: events still enqueue to the
> outbox; the dispatcher just idles until you flip it on (nothing is lost).

---

## 3. End-to-End Verification

The goal here is simple: prove that when a customer pays in Goalhub, the money
automatically shows up in the Expresswash books a few seconds later. Do a few
test transactions and watch them flow through.

1. Make one real (or sandbox) **Goalhub booking payment**.
2. Within ~30s confirm the chain:
   - Goalhub DB: `SELECT status, hub_journal_entry_id FROM accounting_events ORDER BY created_at DESC LIMIT 5;` → `sent`.
   - Hub DB: matching `ledger_ingest_events` row `status='posted'`; entry under **/admin/accounts**.
3. Exercise each event type at least once: booking payment (M-Pesa/PesaPal), **manual walk-in (cash)**, wallet top-up, booking paid with wallet credit (redemption), a cancellation/refund, and a fine (cash + credit).
4. Confirm each produced a balanced journal entry against the expected accounts (see mapping table below).

---

## 4. Reconciliation (do this before trusting the numbers)

"Reconciliation" just means: does the total in the new central books match what
Goalhub already thinks it earned? Before anyone relies on these numbers, take one
finished month and check that the two sides agree.

Pick one closed month and compare the **hub** totals against Goalhub's own revenue dashboard:
- Turf Revenue (`4100`), Fine Income (`4120`), Academy Revenue (`4130`) — these should roughly match Goalhub's reported income for the month.
- Customer Wallet (`2210`) — should equal the total unspent wallet/credit balances Goalhub is still holding for customers.
- M-Pesa – Goalhub (`1021`) + Cash (`1000`) — the money that actually came in should match Goalhub's payments.

If a number is off, it's almost never a "the sync is broken" problem — it's
usually just that an event is pointed at the wrong account. That's a one-line
data fix on the hub (no code change, no redeploy). The table below is where each
type of transaction currently lands; edit a row if reconciliation shows it's wrong:

```sql
-- hub: change which accounts an event type books to
UPDATE ledger_ingest_mappings
SET debit_account_key = '<system_key>', credit_account_key = '<system_key>'
WHERE source_system='goalhub' AND event_type='<event>';
```

### Current Goalhub → ledger mapping (starter set, validate here)

Each row reads as: "when THIS happens in Goalhub, money moves FROM the Debit
account TO the Credit account." (Double-entry accounting: every transaction
touches two accounts so the books always balance.)

| When this happens in Goalhub | Money goes to (Debit) | Money comes from (Credit) | Plain-English meaning |
|---|---|---|---|
| `booking_payment` — customer pays for a pitch booking | M-Pesa–Goalhub `1021` (or Cash `1000` for walk-ins) | Turf Revenue `4100` | We earned booking income; the cash landed in M-Pesa (or the till) |
| `wallet_topup` — customer loads their wallet | M-Pesa–Goalhub `1021` | Customer Wallet `2210` | Cash came in, but it's **not income yet** — we owe it back as wallet balance |
| `wallet_redemption` — customer pays with wallet balance | Customer Wallet `2210` | Turf Revenue `4100` | They spent their wallet, so now it becomes real booking income |
| `refund` — booking refunded to wallet | Turf Revenue `4100` | Customer Wallet `2210` | We give the income back as wallet credit (the cancellation fee we keep stays as income) |
| `fine_payment_cash` — fine paid in cash | M-Pesa–Goalhub `1021` | Fine Income `4120` | Fine income, paid with cash/M-Pesa |
| `fine_payment_credit` — fine paid from wallet | Customer Wallet `2210` | Fine Income `4120` | Fine income, paid out of their wallet balance |

---

## 5. Open Decisions (confirm during reconciliation)

A few accounting choices were made with sensible defaults, but you should confirm
they match how you actually run the business. None of these block go-live — they're
easy to change later (mostly one-line data edits on the hub).

- [ ] **Is Goalhub's M-Pesa a separate account from Expresswash's?**
  We assumed Goalhub collects money into its own M-Pesa till, so it gets its own
  account (`1021 M-Pesa – Goalhub`) — keeping the two businesses' cash separate on
  the books. If they actually share one M-Pesa number, point Goalhub at the existing
  shared M-Pesa account instead.
- [ ] **Record income when the money moves (cash-basis)?**
  Right now we count income the moment cash is received, not when the booking is
  made or the service delivered. This is the simple, common approach for a cash
  business. Confirm that's how you want the reports to read (the alternative,
  "accrual", counts income when it's earned regardless of when paid — more complex).
- [ ] **Keep Goalhub's cash walk-ins in the shared Cash account?**
  Manual walk-in payments currently go into one shared `1000 Cash` account for the
  whole group. If you want to see Goalhub's cash separately from other businesses',
  we can give it its own cash account. Small addition if you want it.

---

## 6. Known Gaps / Deferred (things not done yet, on purpose)

These are known limitations — nothing is broken, but here's what today's setup does
**not** cover yet, so there are no surprises:

- **Academy enrollments aren't synced yet.** Goalhub doesn't fully finish an academy
  sign-up at the moment of payment (this is a pre-existing gap in Goalhub itself), so
  those payments aren't sent to the books yet. The hub is already set up to accept them
  — we just switch it on once Goalhub completes that flow.
- **A rare double-count risk on old payment methods.** If Safaricom/CreditBank sends the
  same payment notification twice, Goalhub can credit a wallet twice — this is existing
  Goalhub behaviour, unrelated to this project. Our sync won't duplicate the entry on the
  books (it ignores repeats), but the underlying Goalhub bug should be fixed separately.
- **The other brands aren't connected yet** (Kienyeji Hub, ExpressCarpets, and the
  goalfusion landing site). They don't have a system that records transactions, so
  there's nothing to pull from automatically. The plan is to add a simple "enter a
  transaction" / spreadsheet-upload screen that feeds the same pipeline. Not started —
  deferred to a later phase.
- **One combined set of books (not separate books per business).** Everything currently
  lands in a single shared ledger, with each business's income shown on its own line. If
  you ever need a fully standalone balance sheet **per business** (e.g. Goalhub as its own
  legal entity), that's a bigger change we can do later.

---

## 7. Rollback

If you need to stop or undo this, it's low-risk — the whole thing was built as an
add-on and doesn't touch how either app already works.

- **To pause it (instant, safe):** in Goalhub, set `LEDGER_INGEST_ENABLED=false` and
  redeploy. Sending to the books stops immediately. Nothing is lost — transactions keep
  queuing quietly and will send again the moment you switch it back on.
- **To remove it entirely from the hub:** everything new lives in its own tables and one
  new function, separate from the existing accounting. Technically: drop the
  `ledger_ingest_*` objects and the added chart-of-accounts rows, and revert the
  `source_type` constraint. Any test/real entries already posted are undone the normal
  way — reverse them from **/admin/accounts** (they don't get hard-deleted, they get a
  reversing entry, which is the correct accounting practice).

---

## Reference — what shipped
| Repo | PR | Key artifacts |
|---|---|---|
| Expresswash-ke | #58 | migrations `072`/`073`/`074`; `functions/ledger-ingest`; RPC `post_ingested_journal_entry`; tables `ledger_ingest_mappings`, `ledger_ingest_events` |
| Goalhub | #35 | model/table `accounting_events` (Alembic `i1a2b3c4d5e6`); `services/accounting_event_service.py` (enqueue + dispatcher); hooks in payments/booking/refund/fine services; dispatcher wired via FastAPI lifespan |
