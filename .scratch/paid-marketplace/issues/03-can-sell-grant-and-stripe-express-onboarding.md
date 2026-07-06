# 03 — "Can Sell" grant + Stripe Express onboarding

Status: needs-triage

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Seller**, **Admin**, **Edition**). Spec: [`../PRD.md`](../PRD.md). Decision: [ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md).

> **Edition update:** what a Seller ultimately prices is a per-**Edition**
> `(Topic, language)` listing (issue 02/04). This issue is only the seller *capability*
> + onboarding; it is unaffected by the Edition grain except that the `payoutsEnabled`
> gate below protects per-Edition pricing.

## Want

The path by which a user becomes a **Seller**: the Admin grants **can-sell**, the
user completes Stripe **Express** onboarding (billing + address / KYC), and the
platform learns whether they can be paid — so per-Edition pricing (issue 04) can be
gated on it.

## Acceptance

- **`sellers`** relation: `(userId, stripeAccountId?, chargesEnabled, payoutsEnabled)`,
  indexed `by_user`. Absence ⇒ not a Seller. The Admin **can-sell** grant creates
  the row (before any Stripe account exists, `stripeAccountId` is unset and
  `chargesEnabled/payoutsEnabled` are `false`).
- **Admin grant/revoke** in the admin portal (this is the user's "Can Sell button"):
  an **Admin-only** mutation (reuse `assertAdmin` / `isCallerAdmin`) that toggles a
  user's `sellers` row. Revoke does **not** delete already-sold Entitlements; it
  stops new pricing/listing. Surfaced in the existing admin portal
  ([ADR 0011](../../../docs/adr/0011-allowlist-in-convex-admin-portal.md)) next to the
  Allowlist controls.
- **Onboarding action** (Convex **action**, authed, self-only): for a granted user,
  create a Stripe **Express** connected account if none, then create an **account
  link** and return its URL for the client to redirect to (Stripe-hosted KYC +
  billing/address). Persist `stripeAccountId` on the `sellers` row.
- **Capability refresh**: on return from onboarding (and via the Connect webhook,
  `account.updated` — see issue 04), read the connected account's
  `charges_enabled` / `payouts_enabled` and persist them to the `sellers` row.
- **A `mySellerStatus` query** (authed, self): `not-granted | granted-not-onboarded |
  onboarding-incomplete | ready`, driving the dashboard's "become a Seller" affordance
  and gating the price control (issue 04).
- **Guard**: only a `sellers` row with `payoutsEnabled === true` may price an **Edition**
  (enforced in issue 04's per-Edition pricing mutation; the flag is defined here).

## Depends on

- Stripe **platform** setup (a human step): a Connect-enabled Stripe account and the
  `STRIPE_SECRET_KEY` in Convex env. Test-mode keys are fine to build against.

## Notes

- Keep **can-sell (the grant)** distinct from **payoutsEnabled (the onboarding
  result)** — a granted user who hasn't finished KYC still can't be paid, so still
  can't price. CONTEXT's **Seller** definition requires *both*.
- Stripe SDK only in **actions** (it needs `fetch`/secrets); queries/mutations stay
  pure. Mock the Stripe client at the action boundary in tests; assert the
  grant/revoke is Admin-only and the `payoutsEnabled` gate, mirroring
  `whitelist.test.ts`.
- Don't store card/bank details ourselves — Express means Stripe holds them; we keep
  only the `stripeAccountId` + capability booleans.
