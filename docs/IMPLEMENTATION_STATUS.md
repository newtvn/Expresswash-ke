# Implementation Status — Accounting Hub & Render Migration

Resume/handoff note. Snapshot as of **2026-08-31**. Read this first in a fresh session,
then the approved plan at `~/.claude/plans/so-before-we-do-splendid-cray.md`.

## Big picture
Making **Expresswash the group's single source of truth for finances** (Zoho/Odoo-style hub)
and standardizing hosting on **Render**. Other apps (Goalhub first) push financial events into
a shared Expresswash ledger tagged by a `business` slug; the Accounts section is becoming a
multi-business back-office (super_admin = all businesses, admin = Expresswash only).

## ✅ QA SIGN-OFF (2026-08-31)
Pre-cutover E2E QA **passed all gates** across both platforms (Expresswash hub + Goalhub
ingest) via `docs/QA_E2E_LEDGER_TESTPLAN.md`, driven live with chrome-mcp + psql:
Parts A–E all green — trial balance zero, every entry balances, per-business reconciliation
(EW + GH + others = consolidated), idempotency (native + ingest), RLS isolation, ingest
provenance (posted vs failed), and the complete consolidated write-lock (all create/pay/
allocate/refund/repost/reverse controls disabled). Evidence in `docs/QA_E2E_LEDGER_RESULTS_2026-08-31.md`.
**The ledger + multi-business hub are production-ready and MERGED to `main`:**
**#60** (backend B1–B3), **#61** (UI C), and **#62** (082 hardening: validate the ledger
business FK + re-raise `insufficient_privilege` in `update_draft` instead of soft-failing).
All CI green; 082 verified on the Docker local stack. Only remaining work: **A2 Goalhub →
Render cutover** (blocked on Render GitHub App auth + Goalhub Supabase source URL/secrets).

## Session 2 progress (2026-08-31)
- **Workstream A1 done** — Goalhub `render.yaml` converted to Docker runtime + preDeploy `alembic upgrade head` + starter plan; accounting connector env added (disabled). Render Postgres **`goalhub-db`** provisioned via MCP (Frankfurt, basic_256mb, PG16, id `dpg-daaba86k1f9s73ftrb70-a`). Branch `infra/goalhub-render-docker` → **PR newtvn/Goalhub#36**. Decision: DB pre-provisioned via MCP (not blueprint-managed), so it's removed from the blueprint.
- **Workstream B (B1 + B2 + B3) done + verified** — one stacked branch `accounting/multibusiness-b1` → **PR newtvn/Expresswash-ke#60**:
  - **B1** (075 registry + `accounting_resolve_business`; 076 tag 6 source tables + safe backfill + deferrable NOT VALID FK; 077 business-aware `post_journal_entry` via central `accounting_source_business`). Proven no-op: byte-identical before(074)/after(077) report diff.
  - **B2** (078 `is_super_admin`/`accounting_effective_business`/`accounting_can_see_business`; 079 `p_business` on all 6 report RPCs, DROP+recreate; 080 business-scoped admin RLS on ledger + 6 tables, **`ledger_account_balances` leak closed** → `get_ledger_account_balances(p_business)`).
  - **B3** (081 business-aware CRUD): `accounting_write_business` gates creation; `create_invoice/bill_with_lines` take `p_business`; `update_draft` can_see guard; child docs inherit via triggers (payments/credit_notes from invoice, payments_made from bill allocation); `payment_allocations` cross-business guard; `accounting_source_business` extended for refund/allocation entries. No `create_expense` RPC — expenses are client-side inserts secured by the 080 RLS WITH CHECK.
  - Verified on the **Supabase local stack (Docker)**: all 83 migrations apply; B1+B2+B3 assertion suites all pass (report no-op; **Σ(per-business)==consolidated**; RLS hides goalhub from a regular admin; super_admin multi-business CRUD tags rows+ledger; cross-business allocation blocked).
- Local dev initialized: `supabase/config.toml` (PG17 local); validate via `supabase db reset`. Test scripts in `/tmp` (verify_b1/b2/b3.sql, seed/snapshot_reports.sql), not committed. Task tracker + `docs/QA_MULTIBUSINESS_TESTPLAN.md` maintained.
- **Still pending on the user for A2+**: authorize Render GitHub App on private `newtvn/Goalhub`; provide Goalhub's Supabase source DB URL + `LEDGER_INGEST_SECRET` + PesaPal/Firebase/Cloudinary secrets for the cutover/deploy.
- **Workstream C done + verified live** — multi-business hub UI: businessStore + BusinessSwitcher (super_admin), `isSuperAdmin()`, `selectedBusiness` threaded through the 6 report fetchers + ledger overview (keyed), writes disabled in consolidated, invoice/bill/expense pass `p_business`, and `listAccountBalances` switched to `get_ledger_account_balances()` (required by the 080 leak fix). Branch `accounting/multibusiness-ui` → **PR newtvn/Expresswash-ke#61** (stacked on #60). **chrome-mcp verified** on the local stack: super_admin switch EW 3,200 / Goalhub 4,000 / consolidated 7,200 (reconciles), writes disabled in consolidated; regular admin has no switcher, EW-only, Goalhub filtered by RLS; no console errors; tsc + vite build clean.
- Local test scaffolding (not committed): `.env.local` → local stack; two auth users `super@ew.local` / `reg@ew.local` (password `Passw0rd!`); seed lives in the local DB.
- **Remaining**: only **A2+ Goalhub Render cutover** (blocked on user — GitHub App auth + Supabase source URL + secrets). Optional UI follow-ups: ConsolidatedOverviewPanel (per-business drill-down) and scoping the raw journal-entries list to the switcher for super_admin.
- **Deploy coupling:** closing the balances leak means the hub frontend must read balances via `get_ledger_account_balances(...)` — wire in Workstream C before/with the B2 deploy.

## DONE ✅

### Accounting hub — Phase 1 (Expresswash / Supabase)
- Migrations **072** (COA + `ledger_ingest_mappings`), **073** (provenance/idempotency cols on
  `ledger_journal_entries`, `ledger_ingest_events`, `post_ingested_journal_entry` RPC), **074**
  (fine cash/credit mappings). **Merged** (PR #58) **and applied to Supabase** (ran via SQL editor).
- Edge Function **`ledger-ingest` deployed** (`--no-verify-jwt`). **`LEDGER_INGEST_SECRET` set** on
  Supabase (project `bsmlzvenkeumebfbpsab`). URL:
  `https://bsmlzvenkeumebfbpsab.supabase.co/functions/v1/ledger-ingest`.
- Smoke-tested live: post → idempotent replay → 401 bad secret → 422 bad mapping. ⚠️ Leftover test
  entry `external_id=smoke-001` (KES 1,500 Turf Revenue) — reverse via `/admin/accounts` if not done.
- Latest applied migration number = **074** (next new ones start at 075).

### Goalhub connector (Goalhub repo)
- **Merged** (PR #35, `accounting-hub-connector`): `accounting_events` outbox model + Alembic
  `i1a2b3c4d5e6`, `accounting_event_service.py` (best-effort enqueue + per-row `SKIP LOCKED`
  dispatcher), hooks (wallet top-ups, booking payments incl. manual cash, wallet redemptions,
  refunds, fines cash/credit), FastAPI lifespan dispatcher, `env.example`.
- ⚠️ **Not deployed/enabled yet.** `LEDGER_INGEST_ENABLED` defaults false.

### Expresswash frontend on Render
- Static site **`expresswash-web`** live: `https://expresswash-web.onrender.com`
  (service `srv-da3tv40ae00c7397smhg`, Render workspace **My Workspace** `tea-d0nqbdali9vc7388p93g`, "hobby").
- **`render.yaml` merged** (PR #59) with SPA+SEO routes and CSP/security headers; **Blueprint attached**
  and adopted the service. Verified `/admin` → 200 and CSP present. Auto-deploy wired via the
  `newtvn` GitHub connection.
- ⚠️ Vercel **not** decommissioned; **no custom domain** yet (running on the onrender.com URL).

### Docs written this session (in `docs/`, currently uncommitted in working tree)
- `ACCOUNTING_HUB_ROLLOUT.md` — hub + Goalhub-connector deploy/verify/reconcile runbook.
- `INFRA_MIGRATION_PLAN.md` — the earlier hosting-standardization plan.
- `IMPLEMENTATION_STATUS.md` — this file.

## Environment / access facts
- Render MCP is connected (HTTP server, key in `~/.claude.json`). Relaunch sessions in the
  `Expresswash-ke` dir so it loads.
- Render workspace to use: **My Workspace** `tea-d0nqbdali9vc7388p93g`.
- `newtvn` GitHub org connected to Render for the **public** `Expresswash-ke` repo.
- ⚠️ **`newtvn/Goalhub` is PRIVATE** — confirm the Render GitHub App has access before Blueprint/deploy.
- Local tooling available: Postgres 14 binaries (ephemeral test clusters), `gh`, `supabase` CLI
  (linked to `bsmlzvenkeumebfbpsab`). No Docker; Deno not installed.

## NEXT — per the approved plan (`~/.claude/plans/so-before-we-do-splendid-cray.md`)
Locked decisions: **Goalhub DB → Render Postgres now**; **full** multi-business management in the hub;
Goalhub **shares Expresswash's PesaPal merchant**; auth stays split.

1. **Workstream A + P — Goalhub fully on Render** (independent, do first): render.yaml → Docker backend
   + `preDeployCommand: alembic upgrade head`; provision Render Postgres (Frankfurt) + `pg_dump/restore`
   cutover; frontend static via Blueprint; shared PesaPal creds + register Goalhub's own IPN; enable
   the connector (`LEDGER_INGEST_*`); Firebase authorized domains.
2. **Workstream B — multi-business backend** (migrations 075–082, phased): B1 registry+tagging+backfill
   (no behavior change) → B2 per-business reports + `is_super_admin` RBAC + close the
   `ledger_account_balances` leak → B3 full per-business CRUD.
3. **Workstream C — multi-business UI**: BusinessSwitcher (super_admin), consolidated overview,
   per-business drill-down/CRUD, add-business flow.

## Key risks to remember (from the plan)
- `ledger_account_balances` view is currently readable + unscoped → the real cross-business leak (fix in B2).
- Ledger backfill predicate must be exactly `business IS NULL AND source_system IS NULL` (protect ingested rows).
- `post_invoice_to_ledger` is defined twice (060 & 066) — edit the live **066** copy.
- DB cutover is the only stateful step — maintenance window + pause the accounting dispatcher.
