# PRD: Paid Course Marketplace (Stripe Connect)

Status: needs-triage

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — **Seller**, **Entitlement**,
> **Preview**, plus Topic, Guest, Viewer, Public link, Allowlist, Admin. Direction:
> [ADR 0016](../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md).
> Also respects [ADR 0001](../../docs/adr/0001-asynchronous-hub-mediated-teaching-loop.md)
> (no LLM in the web app), [ADR 0011](../../docs/adr/0011-allowlist-in-convex-admin-portal.md)
> (Allowlist / Admin portal), [ADR 0013](../../docs/adr/0013-public-link-shares.md)
> (Public link), and [ADR 0015](../../docs/adr/0015-course-completion-and-certificates.md)
> (account-bound proof). Deferred economics: [issue 01](issues/01-authoring-cost-and-model-provider-strategy.md).

## Problem Statement

Today all course distribution is **free**. An owner **Shares** a Topic (account)
or mints a **Public link** (anonymous Guest), and either grant reads the *whole*
Topic. Three things block a marketplace where a vetted **Seller** sells a finished
course and a learner pays once for lifetime access:

1. **No paid access.** Access is owner / Share / Public-link — all-or-nothing, all
   free. Nothing gates content behind a purchase.
2. **No way to become a Seller.** No user can price a course, connect a payout
   account, or get paid.
3. **The public can't buy.** Sign-up is gated by the **Allowlist** (private alpha),
   so a stranger can neither create an account nor hold a purchase.

## Solution

A paid **marketplace** on top of the existing free model, per
[ADR 0016](../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md):

- A course is **free or paid at the Seller's choice**. A Topic with **no price** is
  free and behaves *exactly* as today (Share / Public link unchanged). A Topic with
  a **price** is paid: its first Lesson is the free **Preview**; everything past it
  needs an **Entitlement**.
- The **Admin** grants a user the **can-sell** capability; the Seller completes
  Stripe **Express** onboarding (billing + address / KYC); only a payouts-enabled
  Seller may price a course.
- A buyer reads the **Preview**, pays once (local currency via Stripe **Adaptive
  Pricing**), and receives a one-time **lifetime Entitlement** unlocking Lessons
  2..N + their References. Payment is via **Stripe Connect direct charge** on the
  Seller's account + an **application fee** to the platform.
- **Payment admits the buyer.** A successful purchase auto-provisions an account
  for the buyer's email, bypassing the Allowlist (which now gates *selling*, not
  *existence*).
- A **paid course must be fully authored and published before listing** — on-demand
  buyer-triggered authoring is incompatible with a paygate. (Enforced by treating
  pricing as available only on a course the Seller has finished; the roadmap's
  publish gate becomes mandatory for paid courses.)

**Ride existing seams — do not scatter paygate checks per surface:**

- **One access seam.** Add a `resolveTopicAccess` helper returning
  `owner | viewer | entitled | preview | none`; extend
  [`getViewableTopic`](../../convex/lib.ts#L68) so an **entitled** buyer is treated
  as a **Viewer** everywhere (read + their own Progress + Certificate eligibility)
  with no new per-surface logic. The **only** new read-fork is the **Preview gate**
  for callers with no access on a paid Topic.
- **Buyer admission mirrors `pendingShares`.** A purchase mints an **email-keyed
  pending Entitlement** that becomes a real Entitlement the moment that email has
  an account — the exact twin of
  [`claimPendingShares`](../../convex/lib.ts#L19). The
  [auth gate](../../convex/auth.ts#L34) is widened to admit an email that has a paid
  purchase.
- **Selling is a new capability**, not a Topic field: a `sellers` relation holding
  the Admin grant + Stripe account id + `chargesEnabled` / `payoutsEnabled`.

## User Stories

### Becoming a Seller
1. As an **Admin**, I want to grant a user the **Can Sell** capability from the
   admin portal, so a trusted user can start selling.
2. As a granted user, I want to complete Stripe onboarding (billing + address /
   KYC) in-app, so I can receive payouts.
3. As a **Seller**, I want to set a price (amount + currency) on a finished,
   published course, so learners can buy it.
4. As a Seller, I want to be **blocked from pricing** a course until my payouts are
   enabled, so I never list something I can't be paid for.
5. As a Seller, I want my payout to be the sale **minus the platform's cut**,
   automatically.
6. As a Seller, I want to keep offering **free** courses (Share / Public link)
   unchanged.

### Buying & access
7. As a **Guest**, I want to read the first Lesson (**Preview**) of a paid course
   free, so I can decide before paying.
8. As a Guest, I want to buy **lifetime access** with a card in **my local
   currency**, so paying is easy.
9. As a buyer with no account, I want an account **created for my email as part of
   buying**, so my purchase is durable and I can sign back in.
10. As a buyer, I want **every Lesson past the Preview + its References** unlocked
    **forever** after paying.
11. As a buyer, I want my purchase to work when I **sign in on another device**.
12. As a buyer, I want a **refund to revoke my access** cleanly.
13. As a buyer who finishes a paid course, I want to **earn a Certificate** like any
    other reader (ADR 0015), since I hold an account.

### Coexistence & safety
14. As a Guest on a paid course, I want locked Lessons to be **clearly gated (not a
    404)**, so I know to buy.
15. As the operator, I never want a **buyer's account creation to grant
    authoring/selling** privileges.

## Implementation Decisions

- **Access resolves at one seam.** `resolveTopicAccess(ctx, userId|null, slug)` →
  level; `getViewableTopic` returns the Topic for an entitled caller too (so
  entitled ≡ Viewer). The Preview gate is the only new branch; **free Topics are
  untouched**.
- **Preview = the lowest-`seq` non-superseded Lesson** (same non-superseded filter
  the Frontier / `listLessons` use).
- **Paid iff `topics.price` is set.** No price ⇒ free ⇒ today's behaviour exactly.
- **Buyer admission** via an email-keyed pending Entitlement + a
  `claimPendingEntitlements` twin of `claimPendingShares`, wired into
  `createOrUpdateUser`; the Allowlist gate also admits an email with a paid
  purchase. A buyer account carries **no** selling/authoring privilege.
- **`sellers` relation** holds `{ userId, stripeAccountId?, chargesEnabled,
  payoutsEnabled }`; the Admin **can-sell** grant creates/enables the row; pricing
  is guarded on `payoutsEnabled`.
- **Stripe Connect · Express · direct charges + `application_fee`**; a webhook in
  [`convex/http.ts`](../../convex/http.ts) mints Entitlements on
  `checkout.session.completed` (idempotent on the Stripe event id) and revokes on
  refund. Stripe SDK calls live in Convex **actions**; no Stripe call in a query.
- **No LLM anywhere here** (ADR 0001). **Authoring funding is deferred**
  ([issue 01](issues/01-authoring-cost-and-model-provider-strategy.md)) and does not
  block this spine — it affects economics, not access mechanics.

## Testing Decisions

**What makes a good test here:** assert access behaviour at the Convex seam, and
the Entitlement lifecycle at the webhook seam; mock Stripe at the action boundary.

- **Access fork** (the core new logic): on a **paid** Topic a Guest and an
  authed-but-unentitled user get **only the Preview** HTML (and a ToC), an
  **entitled** user + owner + Viewer get **everything**; a **free** Topic is
  unchanged. Mirror `public.test.ts` and `sharing-readonly.test.ts`.
- **Entitlement lifecycle**: the webhook mints **once** (idempotent on event id);
  a pending Entitlement is claimed on sign-up (mirror `shares.test.ts`
  pending→claim); a refund **revokes**. Entitled ⇒ Viewer semantics (own Progress,
  Certificate eligibility) but **no** Responses/Questions (owner-only, unaffected).
- **Seller gating**: a non-Seller can't price; a Seller without `payoutsEnabled`
  can't price; the can-sell grant is **Admin-only**. Mirror `whitelist.test.ts` and
  the owned-topic guard.
- **Webhook signature verification** is tested; Stripe API calls are mocked.

## Out of Scope

- **Who funds authoring / BYOK / gateway / Gemini** — [issue 01](issues/01-authoring-cost-and-model-provider-strategy.md).
- **Subscriptions, per-lesson sales, coupons, bundles.**
- **True PPP price tiers** — v1 does local-currency *presentment* (Adaptive
  Pricing) only, not region-discounted prices.
- **Payouts to Sellers in Stripe-unsupported / non-cross-border countries** — a hard
  limit on who can sell.
- **Reviews / ratings, a marketplace discovery catalogue, self-service refund UI**
  beyond an operator/Seller revoke.
- **Naming the buyer role** — deferred to the roles/enrollment work.
- **Per-buyer Responses / Questions** — buyers get Viewer semantics (read + own
  Progress); Responses/Questions stay owner-only (enrollment still deferred).

## Further Notes

- The **take-rate** (application-fee %) and the **refund policy / window** are
  business decisions still open; they're config, not architecture, and were flagged
  in the grilling as un-resolved. Pick before wiring issue 04's checkout.
- Extending `getViewableTopic` to entitled callers is what makes a buyer able to
  earn a **Certificate** — a deliberate, free consequence, not a special case.
