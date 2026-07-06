# 04 — Pricing, checkout, and the purchase webhook

Status: needs-triage

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Entitlement**, **Seller**, **Preview**, **Edition**). Spec: [`../PRD.md`](../PRD.md). Decision: [ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md).

> **Edition update:** the unit sold is an **Edition** `(Topic, language)`. Pricing,
> checkout, and the minted Entitlement are all `lang`-scoped below.

## Want

The money path: a Seller prices a finished course's **Editions**, a buyer pays for one
Edition via Stripe Checkout (Connect direct charge + application fee), and a webhook
mints the `lang`-scoped **Entitlement** — creating/attaching an account for the buyer's
email along the way.

## Acceptance

- **Price an Edition** — owner-only mutation taking `(topicSlug, lang, price)`, guarded
  so the owner is a `sellers` row with `payoutsEnabled` (issue 03) **and** the course is
  `completed` (a paid course must be fully authored before listing — ADR 0016; and
  translation is itself completion-gated). Sets/updates the per-`(topic, lang)` price
  listing (issue 02); clearing it makes that Edition free. Refuses a non-completed
  course. Languages are priced independently.
- **Create Checkout** — Convex **action** (open to Guests; takes `topicSlug` + `lang` +
  the buyer's email): create a Stripe **Checkout Session** for that Edition's price as a
  **direct charge on the Seller's connected account** (`stripeAccount`) with
  `application_fee_amount` = the platform cut, `customer_email` prefilled, success/cancel
  URLs back to that Edition. Adaptive Pricing (local currency) is enabled at the account
  level. The `lang` rides the session metadata. Returns the session URL.
- **Webhook** in [`convex/http.ts`](../../../convex/http.ts) — an `httpAction` that
  **verifies the Stripe signature**, then handles:
  - `checkout.session.completed` → **idempotently** (dedup on the Stripe event id /
    session id) record the purchase and grant access to the buyer's email for the
    session's `lang`:
    - if an account exists for the email → insert an `entitlements` row `(userId,
      topicId, lang)`;
    - else → insert a `pendingEntitlements` row `(topicId, email, lang)` (claimed on
      sign-up by `claimPendingEntitlements`, issue 02).
    Then trigger the buyer-account path (prompt to set a password / sign in; the
    Allowlist gate already admits a paid email — issue 02).
  - `charge.refunded` / `refund` → **revoke**: delete the matching `entitlements`
    (or `pendingEntitlements`) row for that `(buyer, topic, lang)` — other Editions the
    buyer holds are untouched.
  - `account.updated` → refresh the Seller's `chargesEnabled` / `payoutsEnabled`
    (issue 03).
- **Idempotency ledger**: a small `stripeEvents` table (or a unique key on the
  entitlement) so a replayed webhook never double-mints or double-revokes.

## Depends on

- **02** (`entitlements` / `pendingEntitlements` / `claimPendingEntitlements`, the
  admission gate).
- **03** (`sellers` + `payoutsEnabled` gate + `stripeAccountId`).
- Stripe env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in Convex env; the webhook
  endpoint registered in Stripe. **The take-rate (application-fee %) and refund
  policy are open business decisions — pick before wiring.**

## Notes

- Direct charge ⇒ the **Seller is merchant of record** and bears Stripe fees; the
  refund reduces the **Seller's** balance. Decide the **application-fee treatment on
  refund** (returned or kept) when picking the refund policy — flag from the grilling.
- The webhook is the **only** trustworthy mint signal — never grant on the client
  `success_url` (spoofable). Success URL just shows "you're in"; the entitlement
  comes from the verified event.
- Tests: signature verification (reject bad sig); `completed` mints once and is
  idempotent on replay; account-exists → `entitlement`, no-account → `pendingEntitlement`,
  both carrying the session's `lang`; refund revokes the right Edition only; pricing
  refused for non-Seller / no-payouts / non-completed course. Mock the Stripe client;
  mirror `routine.test.ts` for the `httpAction` + secret pattern.
