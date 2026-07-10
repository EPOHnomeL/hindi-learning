# 01 — Prefactor: rip out Stripe, land the PayFast schema + pure module

Status: done

## Parent

[PRD: PayFast Payments](../PRD.md)

## What to build

Turn the branch from a Stripe-shaped marketplace into a PayFast-shaped one, with no
Stripe left and the build green. This is the foundation every other ticket blocks on;
it changes no user-facing behaviour on its own (buying is temporarily disabled until
tickets 3–4 rebuild checkout and the ITN).

- Delete the Stripe integration: `convex/stripe.ts`, the `stripe` npm dependency, and
  the Stripe env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- Add a pure `convex/payfast.ts` (no `"use node"`, no network) providing: an inline
  pure-JS **MD5**; a **signature** builder/verifier over PayFast's scheme (non-empty
  fields, alphabetical order, `&`-joined, passphrase-salted, lowercase hex); a
  **checkout-field builder**; the **net-split math** (`amount_net` cents →
  author/platform shares using `PLATFORM_FEE_BPS`, default 5000, bounded [0,10000]);
  ZAR **cents→Rand** formatting; the sandbox/live **process** and **validate** URLs by
  `PAYFAST_MODE`; and the same-origin `appUrl` helper moved over from `stripe.ts`.
- Reshape the schema (all marketplace tables are empty on dev — no migration):
  `stripeEvents` → `payfastEvents` keyed on `pf_payment_id`; `sellers` loses
  `stripeAccountId`/`chargesEnabled`/`payoutsEnabled` and gains SA payout bank details;
  drop `stripePaymentIntentId` from `entitlements`/`pendingEntitlements`; add a new
  `ledger` table (topic, lang, seller, buyer email, gross, fee, net, author share,
  platform share, `pf_payment_id`, status `owed`|`paid`, optional payout reference).
- Redefine `sellerStatusOf`/`isReadySeller` to the new states
  (`not-granted | granted-no-payout-details | ready`; `ready` = grant + bank details).
- Temporarily disable the Stripe-dependent surfaces so the build stays green: remove the
  `/stripe/webhook` route and neutralise `startCheckout` / seller onboarding actions
  (they are rebuilt in tickets 2–4). Remove or adapt the now-invalid Stripe assertions in
  the existing purchase/seller test files.

## Acceptance criteria

- [ ] `stripe.ts`, the `stripe` dependency, and the Stripe env vars are gone; nothing
      imports Stripe anywhere.
- [ ] `payfast.ts` exists as a pure module; a unit test verifies the **signature** against
      a known field-set/passphrase vector and round-trips build→verify.
- [ ] A unit test covers the **net split**: a normal sale halves `amount_net`, and a
      low-price/fixed-fee-heavy sale still yields non-negative shares that sum to `amount_net`.
- [ ] Schema matches the PRD: `payfastEvents` (by `pf_payment_id`), `sellers` bank-details
      fields, `ledger` table, no `stripe*` fields remain.
- [ ] `sellerStatusOf` returns `not-granted | granted-no-payout-details | ready` with
      `ready` requiring grant + bank details.
- [ ] `pnpm test` and `tsc` are green; `next build` passes.

## Blocked by

- None — can start immediately.

## Comments

**2026-07-10 (agent)** — Done in `48384f9`. Stripe fully removed (stripe.ts, dep, env,
webhook); pure `convex/payfast.ts` landed with RFC-1321 + independently-computed vectors.
One correction (see PRD note): PayFast signs over the fields **in order**, never
alphabetically — `signFields`/`verifySignature` preserve field order. `PLATFORM_FEE_BPS`
is the **platform's** cut (review fix `49eb5c3`): `splitNet` gives the bps to the platform.
