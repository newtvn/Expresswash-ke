# Infrastructure Standardization — Migration Plan

Goal: reduce operational sprawl and land on a clean, consistent hosting story
without destabilizing the accounting source-of-truth.

## Decisions (locked)
- **Goalhub → Render**, deployed **from its Dockerfile** (not Render's native Python runtime).
- **Both frontends → Render static sites.** Vercel is decommissioned entirely.
- **Expresswash backend stays on Supabase** (Edge Functions + Postgres + Auth + RLS + cron). It is not moved — that would be a multi-week rewrite of the books, for no functional gain.
- **Auth stays split**: Firebase (Goalhub) + Supabase Auth (Expresswash). Not in scope now.
- **Goalhub DB → Render Postgres**, but as a **separate, later Phase 3** — never at the same time as the app cutover.

## End state
```
Render
├── goal-backend    (Docker / FastAPI)          ← Goalhub API
├── goal-frontend   (static / Vite)             ← Goalhub web
├── expresswash-web (static / Vite)             ← Express Carpets web
└── goalhub-db      (Render Postgres, Phase 3)  ← Goalhub data, co-located

Supabase
└── ExpressWash project  (bsmlzvenkeumebfbpsab) ← Expresswash backend: DB, Edge Functions, Auth
     └── ledger-ingest  ← accounting hub API (unchanged, platform-agnostic)

Vercel → gone
```

> **The accounting integration is unaffected by any of this.** Goalhub → hub is an
> HTTPS webhook (`LEDGER_INGEST_URL` points at the Supabase function, which isn't
> moving). Nothing about hosting changes that contract.

---

## Why this shape (the one-line rationale)
Goalhub is a normal server app (already has `Dockerfile` + `render.yaml`), so Render
is a natural home. Expresswash *has no server* — its backend **is** Supabase — so there's
nothing to containerize; only its static frontend moves. Both frontends are just Vite
`dist/` folders, so they're trivial static sites on Render.

---

# Phase 1 — Expresswash frontend → Render static (lowest risk, do first)

Pure hosting swap. The Supabase backend (DB, Edge Functions, Auth) is untouched, so this
is a safe warm-up that proves the Render-static approach before we touch Goalhub.

### 1.1 Create the static site
- New Render **Static Site**, repo `Expresswash-ke`, branch `main`.
- Build command: `npm install && npm run build`  (the build already runs `vite build && node scripts/inject-meta.mjs`).
- Publish directory: `dist`.
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (copy from Vercel).

### 1.2 Port `vercel.json` → Render config
Add a `render.yaml` (or set in the dashboard). The security headers + the specific
SEO-page rewrites must be reproduced, not just a blanket SPA fallback:

```yaml
services:
  - type: web
    name: expresswash-web
    runtime: static
    buildCommand: npm install && npm run build
    staticPublishPath: ./dist
    envVars:
      - key: VITE_SUPABASE_URL
        sync: false
      - key: VITE_SUPABASE_ANON_KEY
        sync: false
    headers:
      - path: /*
        name: X-Content-Type-Options
        value: nosniff
      - path: /*
        name: X-Frame-Options
        value: DENY
      - path: /*
        name: X-XSS-Protection
        value: 1; mode=block
      - path: /*
        name: Referrer-Policy
        value: strict-origin-when-cross-origin
      - path: /*
        name: Permissions-Policy
        value: geolocation=(), microphone=(), camera=(), payment=()
      - path: /*
        name: Strict-Transport-Security
        value: max-age=31536000; includeSubDomains; preload
      - path: /*
        name: Content-Security-Policy
        value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co https://pay.pesapal.com https://cybqa.pesapal.com wss://*.supabase.co https://accounts.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://*.supabase.co https://pay.pesapal.com https://cybqa.pesapal.com;"
      - path: /assets/*
        name: Cache-Control
        value: public, max-age=31536000, immutable
    routes:
      # Prerendered SEO pages (must match vercel.json rewrites)
      - { type: rewrite, source: /track,    destination: /track/index.html }
      - { type: rewrite, source: /privacy,  destination: /privacy/index.html }
      - { type: rewrite, source: /terms,    destination: /terms/index.html }
      - { type: rewrite, source: /faq,      destination: /faq/index.html }
      - { type: rewrite, source: /pricing,  destination: /pricing/index.html }
      - { type: rewrite, source: /contact,  destination: /contact/index.html }
      - { type: rewrite, source: /services, destination: /services/index.html }
      # SPA fallback (existing files, incl. /assets/*, are served before this)
      - { type: rewrite, source: /*, destination: /index.html }
```

### 1.3 Supabase-side updates (critical — auth breaks silently otherwise)
- Supabase → **Authentication → URL Configuration**: add the new Render domain to
  **Site URL** and **Redirect URLs** (password reset / magic-link / OAuth redirects fail otherwise).
- If Google sign-in is used: add the new domain to the **Google OAuth authorized origins**.

### 1.4 Cutover
1. Deploy on the Render `*.onrender.com` URL and fully test (login, payments, admin, PDFs).
2. Lower the custom domain's DNS TTL (e.g. 300s) a day ahead.
3. Move the custom domain from Vercel → Render; verify the cert issues.
4. Watch for 24h, then **delete the Vercel project**.

**Rollback:** repoint DNS back to Vercel (kept alive until validated).

---

# Phase 2 — Goalhub → Render (Docker backend + static frontend)

Goalhub's `render.yaml` already defines both services; we switch the backend to build
**from the Dockerfile** and move the frontend off Vercel.

### 2.1 Switch the backend service to Docker
Replace the `goal-backend` service in `Goalhub/render.yaml`. Key changes: `runtime: docker`,
point at the Dockerfile, and move migrations out of `buildCommand` (there is none in Docker
mode) into a **`preDeployCommand`** so they run once per deploy, not per instance:

```yaml
services:
  - type: web
    name: goal-backend
    runtime: docker            # was: python
    region: frankfurt
    plan: starter              # preDeployCommand + always-on need a paid plan (free spins down)
    rootDir: backend
    dockerfilePath: ./Dockerfile   # relative to rootDir (backend/Dockerfile)
    dockerContext: .               # build context = backend/
    preDeployCommand: alembic upgrade head   # runs once before traffic switches
    healthCheckPath: /health
    envVars:
      # ... unchanged (DATABASE_URL, ALLOWED_ORIGINS, MPESA_*, PESAPAL_*, FIREBASE_*, CLOUDINARY_*,
      #     PAYMENT_PROVIDER, FRONTEND_URL, CALLBACK_URL, and LEDGER_INGEST_* for the accounting hub)
```

Notes:
- The Dockerfile already respects `$PORT` (`CMD uvicorn ... --port ${PORT:-8000}`), so it works as-is.
- `preDeployCommand` requires a **paid** instance type. On free, run `alembic upgrade head`
  once via the Render Shell after deploy instead. (Production should be on Starter+ anyway —
  free instances sleep and would delay payment callbacks.)
- Optional Dockerfile hardening (not required): run as a non-root user; use
  `gunicorn -k uvicorn.workers.UvicornWorker` with a couple of workers for production.

### 2.2 Frontend static site
Already defined as `goal-frontend` in `render.yaml` (static, `./dist`, security headers,
SPA rewrite). Just create it on Render and set its env vars: `VITE_API_URL` (→ the new
backend URL) + the `VITE_FIREBASE_*` values (copy from Vercel).

### 2.3 The "don't forget" list (these are what break a payment app on a domain change)
- [ ] **`ALLOWED_ORIGINS`** (backend) → new frontend domain(s).
- [ ] **`FRONTEND_URL`** (backend) → frontend domain (PesaPal redirects to `<FRONTEND_URL>/processing`).
- [ ] **`VITE_API_URL`** (frontend) → new backend domain.
- [ ] **M-Pesa `CALLBACK_URL`** → `https://<new-backend>/api/callback`, **and update it in the Safaricom Daraja portal**.
- [ ] **PesaPal IPN**: re-register against `https://<new-backend>/api/pesapal/ipn` and put the new GUID in **`PESAPAL_IPN_ID`** (the IPN URL is tied to the backend domain).
- [ ] **Firebase → Authentication → Settings → Authorized domains**: add the new frontend domain, or Google Sign-In popups fail.
- [ ] **`LEDGER_INGEST_URL` / `LEDGER_INGEST_SECRET`**: unchanged — leave as-is (the hub isn't moving).

### 2.4 Cutover
1. Deploy both services on `*.onrender.com`; point the frontend at the Render backend URL.
2. Full test: Google login, a real STK push + callback, a PesaPal redirect payment, and confirm an accounting event reaches the hub (`accounting_events.status='sent'`).
3. Move `goalhub.ke` (and the API subdomain, if any) DNS → Render; verify certs.
4. Watch 24h, then **delete the Goalhub Vercel project**.

**Rollback:** DNS back to Vercel; revert `render.yaml` to the Python runtime.

---

# Phase 3 — Goalhub DB → Render Postgres (later, separate, stateful)

Do this only after the app is stable on Render. It's low-risk technically (Goalhub uses
**zero** Supabase-specific features — plain Postgres via SQLAlchemy/Alembic) but it's the
one **stateful** cutover, so it gets its own window.

### 3.1 Provision
- Render **Postgres**, region **frankfurt** (same as the app → use the **internal** connection
  string: co-located, faster, no SSL hop).
- Convert the URL for SQLAlchemy async: Render gives `postgresql://…`; the app needs
  `postgresql+asyncpg://…`. Use the **internal** URL (no `sslmode` needed; asyncpg doesn't take
  `sslmode` as a query param — internal connections avoid that complication).

### 3.2 Migrate the data
Dump only the app's `public` schema (avoid Supabase's `auth`/`storage`/etc. system schemas):
```bash
pg_dump "<supabase-connection>" --schema=public --no-owner --no-acl -Fc -f goalhub.dump
pg_restore --no-owner --no-acl -d "<render-internal-connection>" goalhub.dump
# sanity: alembic_version matches head, row counts match, spot-check payments/bookings/accounting_events
```

### 3.3 Cutover window
1. Put Goalhub in a brief maintenance window; **set `LEDGER_INGEST_ENABLED=false`** first so the
   outbox dispatcher pauses (in-flight events are idempotent anyway, but this keeps it clean).
2. Final `pg_dump` → `pg_restore` to Render Postgres (dataset is small; a full copy is fine).
3. Switch `DATABASE_URL` to the Render internal URL; redeploy.
4. Smoke test (`/health`, a booking, a payment). Re-enable `LEDGER_INGEST_ENABLED=true`; confirm
   the outbox drains.
5. Enable **automated backups** on the Render Postgres.

**Rollback:** point `DATABASE_URL` back at Supabase (kept intact until validated).

---

## Cross-cutting / ops (the actual "life easier" wins)
- **One dashboard**: all three services (+ DB after Phase 3) on Render — one place for logs, metrics, alerts, rollbacks, bills.
- **CI/CD**: Render auto-deploys on push to `main` for each service. Keep Expresswash's existing GitHub Actions (lint/type-check/build) as PR gates.
- **Secrets**: use Render **Env Groups** to organize shared config; nothing secret in the repos (already the case).
- **Docker parity**: Goalhub's `docker-compose.yml` gives devs the same image locally that Render builds — fewer "works on my machine" issues.

## Suggested order & rough effort
| Phase | What | Risk | Effort |
|---|---|---|---|
| 1 | Expresswash frontend → Render static | Low | ~½ day + DNS wait |
| 2 | Goalhub → Render (Docker + static) | Medium (payment callbacks/domains) | ~1–2 days + DNS wait |
| 3 | Goalhub DB → Render Postgres | Low-tech but stateful | ~½ day + a maintenance window |

Phases 1 and 2 are independent; 1 first is recommended as a low-risk warm-up. 3 comes only after 2 is stable.

## What we are deliberately NOT doing
- Not moving Expresswash off Supabase (auth, ~170 RLS policies, ~136 RPCs, 7 Deno Edge Functions, pg_cron) — multi-week rewrite of the books, no functional gain, high risk.
- Not unifying auth (Firebase vs Supabase Auth) — real inconsistency, but a separate project.
- Not changing the accounting hub contract — it's already the right platform-agnostic boundary.
