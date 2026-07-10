# 03 — Checkout initiation: signed PayFast form fields

Status: done

## Parent

[PRD: PayFast Payments](../PRD.md)

## What to build

Clicking **Buy** on a priced Edition takes the buyer to PayFast's hosted checkout. No
access is granted yet (that's ticket 4) — this ticket only gets a correctly-signed,
correctly-addressed payment request to PayFast.

- `startCheckout` (available to Guests) takes the topic slug, language, and the buyer's
  **email**, confirms the Edition is priced and the Seller is ready, and returns the
  **signed PayFast field set** for the client to POST to the hosted process URL
  (sandbox/live per `PAYFAST_MODE`). Fields: platform `merchant_id`/`merchant_key`,
  `amount` (2-decimal Rand from stored cents), `item_name` (title + edition language),
  `email_address`, `return_url` / `cancel_url` / `notify_url` (built via `appUrl`),
  `m_payment_id` (our unique reference), and `custom_str*` carrying `topicId`/`lang`.
  The signature comes from the pure `payfast.ts` builder.
- Persist a **checkout-intent** record (`m_payment_id` → email, topicId, lang) so ticket
  5's return page can prefill+lock the sign-up email without racing the ITN.
- Client: the Buy affordance captures the email, calls `startCheckout`, and auto-submits
  the returned fields as a form POST to PayFast.

## Acceptance criteria

- [ ] `startCheckout` returns the full signed field set for a priced Edition of a ready
      Seller, with the amount rendered as 2-decimal Rand and the signature verifiable by
      `payfast.ts`.
- [ ] It rejects an unpriced Edition and a not-ready Seller.
- [ ] `return_url`/`cancel_url`/`notify_url` are same-origin (via `appUrl`); `notify_url`
      points at the ITN route.
- [ ] A checkout-intent row is written linking `m_payment_id` to the buyer email, topic, and lang.
- [ ] Clicking Buy in the app lands the buyer on PayFast's sandbox hosted checkout.
- [ ] Field-builder/signature unit tests (pure) plus an action test for the reject paths; green.

## Blocked by

- [01 — Prefactor: rip out Stripe, land the PayFast schema + pure module](01-prefactor-payfast-schema-and-module.md)
- [02 — Seller readiness = payout bank details + ZAR pricing gate](02-seller-payout-details-and-pricing-gate.md)

## Comments

**2026-07-10 (agent)** — Done in `13aef87`. `startCheckout` is a MUTATION (no network call
on this rail → intent write + field build in one transaction) returning `{action, fields}`
where `fields` is an ORDERED pair-list (Convex sorts object keys; PayFast signs over field
order). `notify_url` is built from `CONVEX_SITE_URL` (the ITN lives on the Convex origin),
not `appUrl` — the AC's "via appUrl" was unsatisfiable as written. Buy dialog captures the
email and auto-submits the form POST. NOT yet driven against the live sandbox — needs
PAYFAST_* env on judicious-marmot-580 + a coordinated deploy.
