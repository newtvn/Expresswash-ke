# PesaPal sandbox and live refund QA scope

Date: 2026-09-10 EAT

## Objective

Prove that ExpressWash can request a real PesaPal refund, avoid duplicate
provider submissions, wait for independent completion evidence, and post the
correct accounting exactly once. Sandbox and live execution are separate gates;
passing the local provider mock is not a substitute for either.

No refund was initiated while preparing this scope.

## Provider facts that determine the test design

PesaPal API 3.0 documents the following behavior:

- Refunds return funds to the originally charged card or mobile-money wallet.
- Only `COMPLETED` payments qualify.
- The refund cannot exceed the collected amount and must use the original
  currency.
- Card transactions may be partially or fully refunded.
- Mobile-money transactions may only be refunded in full.
- Only one refund request is allowed for a payment.
- The request requires the payment `confirmation_code`, amount, initiating
  username, and remarks.
- A response status of 200 only means the request was received and is being
  processed. It does not prove that funds reached the customer.
- The Refund Request documentation describes finance-team/merchant approval but
  does not document a refund-status endpoint or completion webhook.
- Get Transaction Status can return `REVERSED` for the original payment, but the
  documentation does not state that this is a complete or reliable refund
  settlement signal, particularly for partial card refunds.

Therefore ExpressWash must not infer settlement from Refund Request HTTP 200.
Completion remains an independently evidenced operation unless PesaPal confirms
a supported machine-readable settlement mechanism in writing.

Official references:

- https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/refund-request
- https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus
- https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/authentication
- https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/api-reference

## Current implementation facts

Implemented and locally verified:

- Migration `084` reserves one provider refund per payment and one idempotency
  key per business.
- Only authenticated accounting admins can prepare a request.
- Only the server-side service role can persist provider submission results;
  direct customer and admin negative tests pass.
- The Edge Function fetches fresh PesaPal transaction status and validates
  completed status, amount, currency, confirmation code, and payment method
  before calling Refund Request.
- Mobile partial refunds are rejected before the provider call.
- Provider acceptance is stored as `processing` and posts no accounting.
- An unknown outcome after submission is retained as `processing`; replay does
  not send a second provider request.
- A separately authorized completion action requires an evidence reference and
  creates one `customer_refunds` row and one linked journal.
- Local mock tests cover partial/full card, full mobile, mobile partial denial,
  provider rejection, timeout replay, unauthorized access, and completion
  replay.

Production backend status as of this document:

- Migration `20260909000002` is applied.
- `refund-payment` is ACTIVE at deployed version 1.
- A post-deploy download of the function and both shared modules matches the
  local reviewed source byte-for-byte.
- Missing-auth requests are rejected with HTTP 401.
- Authenticated production negative tests prove a customer is denied and an
  admin request for a nonexistent payment stops before the provider.
- PesaPal configuration secret names are present, but their values and whether
  the production project is configured for `live` or `sandbox` were not exposed.

## Gaps to close before a genuine refund

### Required before sandbox

1. Create or nominate an isolated ExpressWash staging Supabase project. Do not
   switch `PESAPAL_ENVIRONMENT` or credentials on the production project.
2. Apply the production schema through migration `084` to staging and deploy
   `stk-push`, `payment-callback`, and `refund-payment` from the same reviewed
   commit.
3. Obtain a dedicated PesaPal sandbox merchant account, consumer key/secret,
   active sandbox IPN ID, and test payment instruments. Store them only as
   staging Edge Function secrets.
4. Give PesaPal a publicly reachable HTTPS callback/IPN endpoint for staging.
5. Deploy the current frontend to staging or use a controlled test client pointed
   only at staging. The production frontend does not yet contain the new refund
   UI because these changes are uncommitted and not on Render `main`.
6. Confirm the exact accounting business event for each fixture. A refund of a
   canceled invoiced service requires the related credit-note/revenue reversal;
   the refund journal alone restores A/R and credits cash. An unapplied customer
   overpayment may require a customer-credit liability account instead of A/R.

### Recommended hardening before live

1. Put this work on a reviewed commit/PR so the deployed function, migration,
   frontend, and evidence all identify one immutable SHA.
2. Add an explicit completion actor and evidence type to provider refund records,
   and decide whether request and completion require different admins.
3. Define the accepted evidence sources: PesaPal merchant-dashboard reference,
   settlement report line, or PesaPal support case. Free-form text without an
   independently retained artifact is insufficient for live settlement.
4. Confirm with PesaPal whether completed full refunds reliably change Get
   Transaction Status to `REVERSED`, and how partial card-refund completion can
   be queried. Automate only a documented signal.
5. Decide whether customer notification is required at request, rejection, and
   confirmed completion.
6. Decide the minimum operator identifier sent as PesaPal `username`. Prefer an
   approved display label or internal operator reference over falling back to an
   email address.
7. Restrict the refund Edge Function CORS origin to approved application origins
   if operational tooling does not require wildcard CORS.

## Sandbox execution matrix

Use separate completed payments because PesaPal permits one refund request per
payment.

| Fixture | Provider action | Expected ExpressWash result |
|---|---|---|
| Card payment A | Partial refund | `processing`; no refund journal |
| Card payment B | Full refund | `processing`; no refund journal |
| Mobile payment A | Full refund | `processing`; no refund journal |
| Mobile payment B | Attempt partial refund | Rejected before PesaPal call |
| Pending/failed payment | Attempt refund | Rejected before PesaPal call |
| Completed payment missing confirmation code | Attempt refund | Rejected before PesaPal call |
| Card payment C | Double-click/replay same key | One provider request |
| Card payment D | Second distinct key | Rejected by one-payment constraint |
| Accepted refund | Confirm without evidence | Rejected; no journal |
| Accepted refund | Confirm with retained evidence | One refund and one journal |
| Completed refund | Replay completion | Same refund/journal IDs |

For each provider call retain a redacted timestamp, merchant reference, order
tracking ID suffix, confirmation-code suffix, amount/currency, HTTP status,
provider message, ExpressWash request ID/status, and database/journal assertion.
Never retain bearer tokens, consumer secrets, full phone/card data, or raw
customer payloads.

Sandbox exit criteria:

- All rows above pass against PesaPal sandbox, not only the mock.
- PesaPal dashboard shows exactly one request per eligible payment.
- Accepted requests remain unposted until independent completion evidence.
- Trial balance remains zero and the completed journal matches the approved
  business event.
- Timeout/replay testing proves no duplicate request.
- Function/database logs contain no secrets or unhandled errors.

## Live low-value test

Run only after sandbox exit criteria and the recommended hardening are closed.
The cleanest fixture is a new, self-owned, low-value transaction rather than an
existing customer payment.

1. Record the named merchant approver, operator, customer/test owner, maximum
   amount, method, and execution window.
2. Create and complete a low-value live payment using a payment instrument owned
   by the consenting tester. Prefer a full mobile-money refund for the minimum
   live proof; it exercises the stricter rule and leaves no intentionally
   unrefunded balance.
3. Verify PesaPal status is `COMPLETED`, currency/amount match, and the
   confirmation code is stored.
4. Capture pre-refund database and ledger state and the expected journal pair.
5. Request the refund once with a recorded reason and idempotency key.
6. Verify PesaPal acceptance appears only as `processing`, with no cash-out
   journal and no customer claim that money has arrived.
7. Complete the merchant/PesaPal approval process outside ExpressWash.
8. Independently verify the destination wallet/card received the funds and
   retain the approved evidence reference.
9. Use “Confirm Completed and Post” once. Verify the provider request,
   `customer_refunds` record, evidence, journal links, cash balance, A/R or
   customer-credit treatment, audit actor, reports, and trial balance.
10. Replay both the request and completion identifiers and prove no second
    provider request or journal is created.

The live action moves real money and needs an action-time confirmation naming the
exact amount, payment, destination instrument owner, operator, and evidence
plan. Approval to prepare this scope or deploy backend code is not approval to
send the refund.

## Go/no-go result

Current status: **NO-GO for genuine sandbox or live refund**.

The provider mock and production backend deployment are ready, but a real
sandbox run still needs an isolated staging project, sandbox merchant
credentials/IPN, a reachable callback, and reviewed accounting fixtures. Live is
additionally blocked on sandbox evidence, immutable reviewed deployment SHA,
merchant approval, completion evidence rules, and explicit transaction-level
authorization.
