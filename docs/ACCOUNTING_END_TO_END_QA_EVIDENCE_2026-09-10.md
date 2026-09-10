# Accounting end-to-end QA evidence — 2026-09-10

## Run identity and verdict

- Reviewed base commit: `c55bb0f95df154f18ccb5cf27f3faf7dfc4737b8`
- Release commit: `968e41d5dfaed714d3e0fa19f2b3695ffd9dbe61`
- Pull requests: #68 and #69, merged
- Tester: Codex
- Test window: 2026-09-09 through 2026-09-10 EAT (`Africa/Nairobi`)
- Local web: `http://127.0.0.1:8080`
- Local Supabase API: `http://127.0.0.1:54321`
- Production web: `https://expresswash-web.onrender.com`
- Production Supabase project: `bsmlzvenkeumebfbpsab`
- Final verdict: **BLOCKED — not release-ready**

The fixes and local automated suites pass, and production now contains migration
`084` plus the `refund-payment` Edge Function. The full runbook release gate is
still not met: the formerly tracked production service-role credential has not
been proven rotated/revoked, the authenticated multi-role/viewport browser
matrix remains incomplete, the post-deploy ACC-17/18 browser retest is blocked
by Chrome's open extension UI, and genuine PesaPal sandbox/live settlement
evidence is outstanding.

## Changes made during the run

### ACC-17 — invoice Payment crash

- Added the missing `Edit2` import used by the Payment action in
  `AdminInvoices.tsx`.
- Type-check and production build now resolve the symbol.
- The authenticated production smoke failed: the Payment dialog opened, but
  Cancel crashed `/admin/invoices` with `Edit2 is not defined`. The deployed
  bundle at that time did not contain the reviewed fix. PR #69 subsequently
  deployed the fix; its authenticated production retest is pending.

### ACC-18 — sticky admin error boundary

- Added route reset keys to the shared error boundary and wired the admin layout
  to reset on pathname changes.
- Added a regression test that injects a render error and proves a route-key
  change restores the child route.
- The production sidebar recovery smoke failed: navigation changed the URL from
  `/admin/invoices` to `/admin/accounts`, but the invoice error boundary stayed
  visible. The Try Again control recovered the Accounts page. Back/Forward,
  Home, Reload, and the remaining keyboard recovery paths are still pending.
  PR #69 subsequently deployed the route-reset change; its authenticated
  production retest is pending.

### ACC-19 — provider-backed PesaPal refunds

- Added migration `20260909000002_084_pesapal_provider_refunds.sql` with a
  business-scoped request ledger, one-request-per-payment and idempotency
  constraints, guarded state transitions, and separate settlement completion.
- Added the `refund-payment` Edge Function and PesaPal Refund Request adapter.
- Restricted provider submission-state transitions to the Edge Function's
  server-side service context; even a super admin is denied direct RPC access.
- Added accounting repository/application types and the admin Accounts workflow.
- Kept PesaPal acceptance in `processing`; it creates no refund journal.
- Settlement completion requires evidence and posts accounting exactly once.
- Added request timeouts and a conservative unknown-outcome state that prevents
  a second provider submission after a timeout.
- Renamed the existing accounting-only action to “Record Refund Already Sent” so
  it is not confused with a provider repayment.

### ACC-20 — integration credential safety

- Removed the hard-coded production URL, service-role material, account IDs, and
  passwords from the tracked integration helper.
- Integration credentials are now runtime-only environment variables.
- The helper defaults to local Supabase and refuses any non-local hostname unless
  `ALLOW_PRODUCTION_INTEGRATION_TESTS=true` is explicitly set.
- Removed a second direct production URL and anon credential from the auth
  integration test; unauthenticated negative cases now use the same guarded test
  target as the rest of the journey.
- Default Vitest discovery now excludes `src/test/integration/**`; `npm test`
  cannot silently execute the mutation suite.
- The guard was negatively tested with a non-local URL and failed before network
  access.
- A source and built-asset marker scan found no service-role/provider secret
  markers. Rotation/revocation of the historical production credential remains
  externally unverifiable and therefore blocked.

### QA infrastructure defects fixed

- Added deterministic integration sequencing: auth → customer → driver → admin.
- Added the previously missing bundle-budget script and made it compatible with
  this repository's ES-module configuration.
- Updated the runbook's expected function inventory from seven to eight to
  include `refund-payment`.

## Automated command results

| Gate | Result | Evidence |
|---|---|---|
| `npx tsc --noEmit` | PASS | Exit 0 |
| `npm run lint` | PASS WITH WARNINGS | 0 errors; 9 existing warnings |
| `npm test` | PASS | 14 files, 118 tests |
| Local integration journey | PASS | 4 files, 55 tests; isolated local Supabase |
| `npm run performance:check` | PASS | Build passed; all budgets below thresholds |
| `git diff --check` | PASS | Exit 0 |
| `supabase db reset --local` | PASS | Clean replay through migration `084` |
| `supabase db lint --local` | PASS WITH WARNINGS | 0 errors; 2 existing unused-variable warnings |
| `supabase/tests/accounting_integrity.sql` | PASS | Transaction completed and rolled back |
| Local PesaPal mock suite | PASS | All eight summarized scenarios passed |

Bundle evidence:

- Total JavaScript: 2,536,031 bytes (budget 3,145,728).
- Largest JavaScript chunk: 432,379 bytes (budget 512,000).
- Largest CSS bundle: 121,722 bytes (budget 153,600).

The build also generated route-specific HTML for `/track`, `/privacy`, `/terms`,
`/faq`, `/pricing`, `/contact`, and `/services`. The only build warning was the
existing stale Browserslist database notice.

Database-lint warnings are existing unused variables in
`redeem_loyalty_reward` and `calculate_order_pricing`. The accounting SQL suite
also emitted two non-fatal notification warnings because deliberately synthetic
payment fixtures have no notification recipient; all assertions passed and the
transaction rolled back.

## PesaPal refund evidence

The local provider mock and Edge Function exercised:

| Scenario | Result |
|---|---|
| Partial card refund | Accepted as processing, then completed separately |
| Full card refund | Accepted as processing |
| Full mobile-money refund | Accepted as processing |
| Partial mobile-money refund | Rejected before provider submission |
| Provider rejection | No cash-out journal |
| Timeout after submission and replay | One provider submission; reconciliation required |
| Customer/unauthorized role | Rejected |
| Completion replay | Idempotent; one refund and one journal |

SQL additionally proves reservation creates no journal, the same idempotency key
replays the same request, a second request for the payment fails, completion
links evidence/refund/journal, and a completed provider refund cannot be changed
back to another provider status.

No genuine PesaPal sandbox or live refund was attempted. A low-value live refund
requires explicit merchant authorization, and production does not yet contain
the implementation.

## Production read-only evidence

All tested public URLs returned HTTP 200 with HTML:

- `/`
- `/auth/signin`
- `/admin`
- `/admin/accounts`
- `/pricing`
- `/track`
- `/privacy`
- `/terms`
- `/faq`
- `/contact`
- `/services`

Observed response headers include CSP, HSTS, X-Content-Type-Options,
X-Frame-Options, Referrer-Policy, and Permissions-Policy. The production root
responded in approximately 0.44–0.54 seconds during this sample. A scan of the
downloaded production entry/vendor assets and the local `dist` JavaScript found
no `service_role`, Supabase secret-key, PesaPal consumer-secret, or Render-key
markers.

Production Supabase reports these eight active functions:

1. `create-user`
2. `generate-pdf`
3. `ledger-ingest`
4. `notification-worker`
5. `payment-callback`
6. `refund-payment` (version 1)
7. `send-notification`
8. `stk-push`

Migration `20260909000002` was applied through a temporary manifest matching the
existing consolidated production ledger. The mandatory dry-run showed exactly
one pending migration before deployment, and the post-deploy migration inventory
aligned through `084`. No historical ledger entries were repaired or rewritten.

`refund-payment` was then deployed from the reviewed working tree. A missing-auth
request returned HTTP 401. Authenticated negative smokes also proved that the QA
customer is denied before mutation and the QA admin stops at `Payment not found`
for a guaranteed nonexistent payment, before any provider call. A post-deploy
download matched `refund-payment/index.ts`, `_shared/logger.ts`, and
`_shared/paymentProviders.ts` byte-for-byte with the local reviewed sources.

The required PesaPal and application secret **names** were present in the
production function environment inventory. Values were not printed or captured.

Render's public site was reachable and returned the security headers above, but
no `RENDER_API_KEY` was available in the secure shell environment and the
controlled dashboard tab was unavailable. Deploy ID, terminal build status, and
deployed commit SHA are therefore unverified.

## Browser and route matrix

| Surface | Desktop | Responsive | Keyboard | Result |
|---|---:|---:|---:|---|
| Local public landing page | Partial | Not run | Accessibility tree inspected | BLOCKED |
| Local auth/customer | Sign-in attempt interrupted | Not run | Not run | BLOCKED |
| Local driver | Not run | Not run | Not run | BLOCKED |
| Local warehouse | Not run | Not run | Not run | BLOCKED |
| Local admin/accounting | Not run | Not run | Not run | BLOCKED |
| Production signed-out routes | Landing, auth forms, route titles, and admin redirects checked | Landing and Track checked at 390×844 | Track form traversal partially checked | PARTIAL — mobile overlap found |
| Production customer | Not run | Dashboard, orders, invoices, and payments checked at 390×844 | Not run | PARTIAL |
| Production driver | Not run | Dashboard, route, orders, and cash checked at 390×844 | Not run | PARTIAL |
| Production warehouse | Not run | Intake, processing, quality, and dispatch checked at 390×844 | Not run | PARTIAL |
| Production admin/accounting | Dashboard, Accounts, Invoices, profile, and all Accounts tabs checked | Accounts and Invoices checked at 390×844 | Header traversal partially checked | FAIL — invoice crash and sticky boundary |

The controlled browser successfully exposed the complete local landing-page
accessibility tree, including primary navigation, booking controls, services,
pricing, FAQ, contact, and footer links. It became unavailable during local admin
sign-in and continued failing after reconnecting and opening a fresh controlled
tab. Automated integration, component, type, build, and HTTP checks supplement
this evidence but do not replace the missing manual matrix.

### Chrome continuation — 2026-09-10

Chrome control was restored in a fresh QA tab. The production landing page was
visually checked at the default desktop viewport and at 390×844. Both views
rendered their expected navigation, hero, booking, services, process, pricing,
FAQ, contact, and footer content, and the mobile layout exposed no horizontal
document overflow. The signed-out Track page also rendered at 390×844 with its
tracking field and Track button. Keyboard traversal reached the tracking field,
Track button, Schedule Pickup button, and Call Us link in logical order.

The following signed-out routes were opened in the controlled browser and
returned their route-specific document titles: `/`, `/track`, `/pricing`,
`/privacy`, `/terms`, `/faq`, `/contact`, and `/services`. The sign-in, sign-up,
and forgot-password forms rendered at desktop width. Direct visits to `/admin`
and `/admin/accounts` redirected to `/auth/signin`. The browser log contained no
errors; its only warning was the expected `Sentry DSN not configured` message.

Responsive defect found: at 390×844 the floating green “Get a Quote”/WhatsApp
control overlaps the quick-booking form around the Location/Preferred Date area
and also overlays lower-page CTA content. Treat this as a mobile usability defect
and verify the eventual fix across the public routes.

### Authenticated Chrome continuation — 2026-09-10

The documented QA credentials were used after explicit confirmation. No
production record was created, edited, posted, reversed, replayed, or deleted.
Each role was signed out after its read-only walkthrough, and Chrome's temporary
responsive viewport override was reset at the end.

- **Customer:** the 390×844 dashboard, orders, invoices, and payments routes
  rendered with the expected customer navigation and data. Authentication
  initially returned to the public home page; the customer had to use Go to
  Dashboard to reach `/portal/dashboard`.
- **Driver:** the 390×844 dashboard, route, orders, and cash routes rendered.
  The PWA install prompt overlays some lower content on the orders view.
  Authentication also returned to public home before Go to Dashboard was used.
- **Warehouse:** the 390×844 intake, processing, quality, and dispatch routes
  rendered. A direct warehouse-role visit to `/admin/accounts` was denied and
  redirected to the public home page. Authentication again returned to public
  home before Go to Dashboard was used.
- **Admin/accounting:** the desktop dashboard, profile, Accounts, and Invoices
  routes rendered. The admin profile retained the admin shell. Accounts and
  Invoices also rendered at 390×844 without horizontal document overflow.
  Consolidated scope correctly disabled business-specific create, reverse,
  post, replay, and similar controls. Reports, Ledger, Purchases & Expenses,
  Payments Received, Aging Summary, Payables & Bills, Credits & Refunds,
  Posting Gaps, Contacts, and Outbox all rendered. The Outbox showed a pending
  notification with Replay disabled in consolidated scope.

Two deployed regressions block acceptance. Opening the first invoice's Payment
dialog succeeded, but Cancel rendered the admin error page with `Edit2 is not
defined`. Selecting Accounts in the sidebar changed the URL without clearing
that error page; Try Again recovered the Accounts UI. This directly reproduces
ACC-17 and ACC-18 in the deployed application.

The Reports view also briefly displayed zero balance-sheet values and an
out-of-balance label while asynchronous data was loading; after the page settled,
the ledger totals and outstanding amount populated. This should be retested as a
loading-state consistency issue rather than treated as an accounting result.

The final browser diagnostic check contained no captured errors and two Sentry
configuration warnings. The `Edit2` failure is evidenced by the rendered error
boundary, even though it was not retained in the final diagnostic log buffer.

### Fix rollout — 2026-09-10

The accounting/refund follow-up was committed as `73554a0`, reviewed by GitHub
CI, and merged through PR #69 as `968e41d`. Build, lint/type-check, security
audit, and preview checks passed. Render auto-deploy
`dep-dah2qsnavr4c73e1rdig` completed successfully in 33 seconds, and the Render
dashboard identifies `968e41d` as the live production commit.

Local verification after the merge passed: 118 unit/component tests, TypeScript
with no errors, the production build, lint with nine pre-existing warnings and
no errors, and all 55 guarded integration tests against local Supabase. No
production integration suite was run. The existing local QA fixtures were used;
an attempted fixture reseed was stopped by the local Auth admin-key path before
any fixture change, then the guarded suite completed normally.

The authenticated post-deploy browser smoke could not start because Chrome
reported an open extension UI and detached its debugger during sign-in. Failed
automation attempts left both credential fields empty and made no authenticated
request. Dismissing that Chrome extension UI is required before ACC-17/18 can be
closed.

## Incident during the run

Before the unsafe test discovery was identified, the first `npm test` invocation
also discovered the integration directory and contacted production using the
then-hard-coded helper. It reported 167 of 169 tests passing and two authentication
timeouts. The suites include cleanup hooks for created orders and related rows,
but they also exercise mutable test-account and driver state; complete production
cleanup could not be proven with read-only access. This is recorded as a
production-data review item, not treated as clean. The configuration and helper
were immediately changed so default tests exclude integration and integration
requires explicit runtime credentials plus the production opt-in flag.

A later final scan also found that the auth integration's wrong-password test had
its own direct production URL and public anon key instead of using the helper.
That single negative request did not authenticate or mutate data, but it still
violated isolation. It was replaced with the guarded local client, the credential
literal was removed, and all 55 integration tests then passed against local
Supabase. The final clean-replay run completed in 2.15 seconds.

## Residual blockers and required release actions

1. Rotate/revoke the formerly tracked production Supabase service-role
   credential, update every legitimate consumer, and prove the old credential no
   longer works without printing either value.
2. Review production for artifacts or state changes from the unintended legacy
   integration run and remove or restore only confirmed QA records through an
   approved production change process.
3. **Closed:** migration, function, frontend, and evidence were reviewed and
   merged through PR #69 as immutable release commit `968e41d`.
4. **Closed:** Render deploy `dep-dah2qsnavr4c73e1rdig` is live at `968e41d`.
5. Retest ACC-17/18, fix or accept the role landing/mobile-overlay
   findings, and complete the still-missing desktop, keyboard, navigation,
   loading/empty/error-state, console, and network portions of the runbook.
6. Run the genuine PesaPal sandbox suite. Perform a live low-value refund only if
   separately and explicitly authorized after the sandbox and security gates
   pass.

Until all six items are closed and retested, ACC-20 and ACC-21 remain
`BLOCKED`, ACC-17/18/19 remain `IN PROGRESS`, and the release verdict remains
**BLOCKED**.
