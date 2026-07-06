# 04 — Pricing, checkout, and the purchase webhook

Status: needs-triage

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Entitlement**, **Seller**, **Preview**). Spec: [`../PRD.md`](../PRD.md). Decision: [ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md).

## Want

The money path: a Seller prices a finished course, a buyer pays via Stripe
Checkout (Connect direct charge + application fee), and a webhook mints the
**Entitlement** — creating/attaching an account for the buyer's email along the way.

## Acceptance

- **Price a Topic** — owner-only mutation, guarded so the owner is a `sellers` row
  with `payoutsEnabled` (issue 03) **and** the course is finished/published (a paid
  course must be fully authored before listing — ADR 0016). Sets/updates
  `topics.price`; clearing it makes the course free again. Refuses on a `seeded`
  course.
- **Create Checkout** — Convex **action** (open to Guests; takes `topicSlug` + the
  buyer's email): create a Stripe **Checkout Session** as a **direct charge on the
  Seller's connected account** (`stripeAccount`) with `application_fee_amount` = the
  platform cut, `customer_email` prefilled, success/cancel URLs back to the course.
  Adaptive Pricing (local currency) is enabled at the account level. Returns the
  session URL.
- **Webhook** in [`convex/http.ts`](../../../convex/http.ts) — an `httpAction` that
  **verifies the Stripe signature**, then handles:
  - `checkout.session.completed` → **idempotently** (dedup on the Stripe event id /
    session id) record the purchase and grant access to the buyer's email:
    - if an account exists for the email → insert an `entitlements` row;
    - else → insert a `pendingEntitlements` row (claimed on sign-up by
      `claimPendingEntitlements`, issue 02).
    Then trigger the buyer-account path (prompt to set a password / sign in; the
    Allowlist gate already admits a paid email — issue 02).
  - `charge.refunded` / `refund` → **revoke**: delete the matching `entitlements`
    (or `pendingEntitlements`) row.
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
  idempotent on replay; account-exists → `entitlement`, no-account → `pendingEntitlement`;
  refund revokes; pricing refused for non-Seller / no-payouts / seeded course. Mock
  the Stripe client; mirror `routine.test.ts` for the `httpAction` + secret pattern.
