# 05 — Delete the guest-purchase machinery

Status: open

## Parent

[PRD: Auth-first checkout + open sign-up](../PRD.md)

## What to build

With auth-first live, the account-less buy path is unreachable — delete it.

- Schema: drop the `pendingEntitlements` table (prod marketplace tables are empty; dev
  holds no pending rows). `pendingShares` **stays**.
- `convex/market.ts` `fulfillPurchase`: the no-account branch **throws** ("no account for
  intent email") — the transaction rolls back including the `payfastEvents` idempotency
  row, so PayFast's retry re-runs it whole.
- `convex/lib.ts`: delete `hasPendingEntitlement` + `claimPendingEntitlements`;
  `convex/auth.ts` drops the claim call (admission checks already went in issue 01).
- `market.checkoutStatus`: states shrink to `awaiting-payment | granted`; the `email`
  field is dropped from the return shape (no consumer left; bearer-token PII leak).
- Tests: delete the pending-Entitlement lifecycle/claim tests; add the
  fulfil-throws-and-persists-nothing case.

## Acceptance criteria

- [ ] `pendingEntitlements` gone from schema and all code paths; `pendingShares` untouched.
- [ ] `fulfillPurchase` with an intent email matching no account throws and persists nothing (no entitlement, no ledger row, no payfastEvents row).
- [ ] `checkoutStatus` returns only `awaiting-payment`/`granted` and no email.
- [ ] `tsc`, tests, build green.

## Blocked by

- [02 — Auth-first checkout: the account is the buyer](02-auth-first-checkout.md)
- [04 — Return UX: confirming banner, reactive unlock](04-return-confirming-banner.md)
  (SignIn's locked-email consumer of `checkoutStatus.email` must be gone first)
