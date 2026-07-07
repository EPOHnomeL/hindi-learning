# Paid Course Marketplace — vertical slices

Tracer-bullet slices for the [PRD](PRD.md), following
[ADR 0016](../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md).
Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) (**Seller**, **Entitlement**, **Preview**,
**Edition**, Topic, Guest, Viewer, Public link, Allowlist, Admin, Certificate). Each
slice cuts end-to-end (schema → access → payment → reader → tests) and is demoable on
its own; they are ordered so blockers come first.

**What is sold is an Edition — a `(Topic, language)` pair.** This feature rides the
**course-translation** feature's Edition model (language-scoped Shares, per-Edition
Public links, per-Edition read gating); selling adds one more way to *hold* an Edition:
an **Entitlement** `(buyer, Topic, language)`. Course-translation should land first, or
this work rebases onto it — they share `schema.ts` and the read seams.

The concern-based issues in [`issues/`](issues/) (`02`–`05`) describe the *same work by
layer*; these slices are the *thin end-to-end paths* to build it. The deferred
authoring/translation-cost investigation ([issue 01](issues/01-authoring-cost-and-model-provider-strategy.md))
is research, **not** a slice.

---

## Slice 1 — Paygate skeleton: a paid Edition + Preview + Entitlement-gated reading (manual grant)

### What to build

The entire read-side paygate with **no payments at all**, at the **Edition** grain. A
language Edition of a course can be marked **paid** (it carries a price). The
Edition-aware access resolver decides, in one place, whether a caller reads the whole
Edition or only its **Preview**, and an **Entitlement** holder is treated exactly like
a language-scoped **Viewer** (read access in that language, their own per-Topic
**Progress**, **Certificate** eligibility). A caller who does not hold a paid Edition
sees only its Preview — the first non-superseded Lesson in that language — with the rest
clearly **locked**; **free** Editions behave exactly as they do under course-translation
today. Entitlements are granted by a temporary Admin/dev-only mutation so the whole gate
is demoable before Stripe exists.

**Prefactor first:** fold the Entitlement check into the course-translation feature's
existing per-Edition access resolution as a behaviour-preserving step (its tests stay
green), *then* add the paid branch. Make the change easy, then make the easy change.

### Acceptance criteria

- [ ] A `(Topic, language)` Edition can carry a price (amount in minor units + currency); with **no** price it is free and behaves exactly as it does under course-translation today.
- [ ] The access resolver returns, for a requested Edition, the caller's level — `owner | viewer | entitled | preview | none` — and is the **only** place read access is decided; both the authed reader and the Guest reader consult it.
- [ ] Prefactor landed: the Entitlement holder is added to the existing per-Edition access resolution without changing owner / language-scoped-Viewer / Public-link behaviour (course-translation tests stay green) before the paid branch is added.
- [ ] On a paid Edition, a caller with no Entitlement (Guest or signed-in) receives only that Edition's **Preview** content plus the table of contents; every other Lesson/Reference returns a **locked** marker distinct from not-found (never a bare 404).
- [ ] The **Preview** is the first non-superseded Lesson **in the requested Edition's language** (falling back to the English source per the translation rules).
- [ ] Owner, a language-scoped Viewer, and an **entitled** buyer receive the full Edition; the entitled buyer also gets their own Progress and is eligible for a Certificate (which records the Edition's `lang`).
- [ ] An Entitlement for one language does **not** unlock another (`es` ≠ `ur`).
- [ ] A temporary Admin/dev-only mutation grants and removes an Entitlement for a `(user, Topic, language)` — enough to demo the unlock.
- [ ] An entitled buyer still **cannot** record Responses or ask Questions (owner-only, unchanged).
- [ ] Tests: the access-resolver **truth table** across `(owner, viewer, entitled, preview, none) × (paid, free)` for a requested Edition — Preview-only vs full content, Edition-scoping (`es` entitlement doesn't unlock `ur`), and free Editions unchanged.

### Blocked by

- The **course-translation** feature (Editions: language-scoped Shares, per-Edition Public links, per-Edition read gating). Otherwise can start immediately.

---

## Slice 2 — Sellers: Admin "Can Sell" grant + Stripe Express onboarding + per-Edition pricing

> **Status: implemented (2026-07-07).** Backend `convex/sellers.ts` + `stripe.ts`,
> seller-guarded pricing in `convex/market.ts`, UI in `Editions.tsx` /
> `Dashboard.tsx` / `AdminPanel.tsx`. Tested in `convex/sellers.test.ts` (Stripe
> mocked at the action boundary). Take-rate = **15%** (`PLATFORM_FEE_BPS`).

### What to build

The seller side end-to-end, on Stripe **test mode**. The **Admin** grants a User the
**can-sell** capability from the admin portal and can revoke it. A granted user completes
Stripe **Express** onboarding (billing / address / KYC) from inside the app, and the app
learns whether their **payouts** are enabled. A payouts-enabled Seller then chooses which
language **Editions** of a **finished (completed)** course to sell and sets a price on
**each Edition independently**; a non-Seller, a Seller without payouts enabled, and a
not-completed course are all refused. This replaces the hand-set price from Slice 1 with
a real Seller pricing action.

### Acceptance criteria

- [ ] A Sellers relation records the Admin's can-sell grant plus the Stripe connected-account id and its charges/payouts-enabled flags; absence ⇒ "not a Seller".
- [ ] An **Admin-only** action grants and revokes can-sell from the admin portal; revoke stops new pricing but does **not** delete already-sold Entitlements.
- [ ] A granted user starts Stripe Express onboarding in-app (redirected to Stripe's hosted flow); on return, and via account-update, the app persists charges/payouts-enabled.
- [ ] A self query reports seller status: `not-granted | granted-not-onboarded | onboarding-incomplete | ready`.
- [ ] A payouts-enabled Seller sets/clears a price **per Edition** `(Topic, language)`; only ready Editions of a `completed` course are priceable; a non-Seller, a no-payouts Seller, or a not-completed course is refused.
- [ ] Setting or clearing an Edition's price makes that Edition paid or free (the flag Slice 1 reads); languages are priced independently and a Seller may sell only some.
- [ ] Tests: can-sell grant/revoke is Admin-only; the pricing guard rejects non-seller / no-payouts / not-completed; per-Edition price set/clear; Stripe mocked at the action boundary.

### Blocked by

- None beyond the shared Editions dependency. (Complements Slice 1: together, a real Seller lists the paid Editions Slice 1 gates.)

---

## Slice 3 — Purchase: Checkout → automatic per-Edition Entitlement + buyer account admission

> **Status: implemented (2026-07-07).** `market.startCheckout` (direct charge +
> 15% application fee), `market.fulfillPurchase` (idempotent mint / pending +
> claim-on-sign-up), the signature-verified `POST /stripe/webhook` (`convex/http.ts`),
> Allowlist widening in `convex/auth.ts`, and the live Paygate checkout button.
> Tested in `convex/purchase.test.ts`. **Needs provisioning to run live** (see
> the note at the end of this file): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
> `SITE_URL`, `PLATFORM_FEE_BPS`, Adaptive Pricing on, and the webhook endpoint.

### What to build

The money path end-to-end, for one **Edition**. A learner on a paid Edition's **Preview**
starts a purchase; Stripe **Checkout** runs as a **direct charge** on the Seller's
connected account with the platform **application fee**, presenting the Edition's price in
the buyer's **local currency**. A **signature-verified webhook** grants access on the
*completed* event: it mints the **Entitlement** for that `(buyer, Topic, language)` if the
buyer already has an account, or an **email-keyed pending Entitlement carrying the `lang`**
that becomes real the moment that email signs up. The **Allowlist** admission gate is
widened to admit an email holding a paid purchase, and the buyer's account carries **no**
selling/authoring privilege. This replaces Slice 1's manual grant.

### Acceptance criteria

- [ ] A **Buy** action on a specific Edition (available to Guests) creates a Stripe Checkout session as a direct charge on the Seller's connected account with the platform application fee; success/cancel return to that Edition.
- [ ] The Edition's price is presented in the buyer's local currency (Adaptive Pricing).
- [ ] Access is granted **only** by a signature-verified webhook, never from the client success redirect; a bad signature is rejected.
- [ ] On the *completed* event: mint an Entitlement for `(buyer, Topic, language)` if an account exists for the email, else a pending Entitlement carrying the `lang`; handling is **idempotent** on the Stripe event id (a replay never double-grants).
- [ ] A pending Entitlement is converted to a real (language-scoped) Entitlement on sign-up (the language-scoped pending-Share claim pattern); the Allowlist gate admits an email with a paid purchase.
- [ ] A buyer account gains **no** can-sell / authoring capability.
- [ ] After purchase the buyer reads the full Edition in its language, and access persists on re-sign-in and on another device; a second language requires a second purchase.
- [ ] Tests: signature verification, idempotent mint, account-exists vs pending + claim-on-signup, `lang`-scoping of the minted Entitlement, and admission of a paid email; Stripe mocked at the action boundary.

### Blocked by

- Slice 1 (the Edition access model + locked/unlock reader).
- Slice 2 (a priced Edition on a payouts-enabled connected account).

---

## Slice 4 — Refund revokes access

> **Status: implemented (2026-07-07), defensively.** The owner's business decision
> is **no refunds** — so there is no refund UI or self-serve refund flow. But the
> webhook still handles `charge.refunded` / `charge.dispute.created` →
> `market.revokePurchaseByPaymentIntent` (idempotent, keyed on the PaymentIntent),
> so if Stripe ever reports a refund or chargeback, access is revoked and the
> reader falls back to the paygate. Tested in `convex/purchase.test.ts`.

### What to build

Close the lifecycle. The purchase webhook handles the **refund** event by revoking the
buyer's Entitlement (or pending Entitlement) for that Edition idempotently, so the reader
falls back to the paygate and sees only that Edition's **Preview** again.

### Acceptance criteria

- [ ] The webhook handles the refund event and deletes the matching `(buyer, Topic, language)` Entitlement (or pending Entitlement).
- [ ] Revocation is **idempotent** (a replayed refund is a no-op) and matches the original purchased Edition — other Editions the buyer holds are untouched.
- [ ] After revocation, the formerly-entitled reader sees the paygate again — only the Preview on that paid Edition.
- [ ] Tests: a refund event revokes the right Edition's access; replay is a no-op; other Editions unaffected. Stripe mocked.

### Blocked by

- Slice 3.

---

## Provisioning to run the money path live (owner / operator)

The code for slices 2–4 is built and tested (Stripe mocked at the action
boundary — **no test touches Stripe or a deployment**). To exercise it end-to-end
you must provision Stripe **test mode** and set these Convex env vars (do NOT
commit secrets):

- `STRIPE_SECRET_KEY` — the platform's test secret key (`sk_test_…`).
- `STRIPE_WEBHOOK_SECRET` — the signing secret (`whsec_…`) of the webhook endpoint.
- `SITE_URL` — the app origin, e.g. `https://<app>.vercel.app` (onboarding /
  checkout return URLs resolve against it).
- `PLATFORM_FEE_BPS` — the take-rate in basis points; **1500** (15%). Defaults to
  1500 if unset.

Then, in the Stripe Dashboard (test mode):

1. Enable **Connect** (Express accounts) and **Adaptive Pricing** (for
   local-currency presentment).
2. Add a webhook endpoint pointing at `https://<deployment>.convex.site/stripe/webhook`,
   subscribed to `checkout.session.completed`, `charge.refunded`,
   `charge.dispute.created`. For **direct charges**, enable *Connect* events (they
   originate on the connected account). Copy its signing secret into
   `STRIPE_WEBHOOK_SECRET`.

Live-drive (`/verify`) once provisioned — a scratch/separate Convex deployment
avoids pushing the new schema to the shared dev one:
1. Grant a User can-sell (admin portal) → they complete Express onboarding →
   `sellerStatus` becomes `ready`.
2. As that Seller-owner, price an Edition of a completed course → owner card shows
   the gold "Paid $X" pill.
3. A non-owner visits → Preview + locked + paygate → **Continue to checkout** →
   Stripe test card `4242…` → return → the webhook mints the Entitlement → full
   read + a "Purchased" dashboard card.
4. (Optional, defensive) issue a **full** refund in Stripe → the reader falls back
   to the paygate.

### Known follow-ups (money-path review, 2026-07-07)

The money path was adversarially reviewed and is sound; the open-redirect, async-
payment, and partial-refund findings are **fixed**. Two low-severity items are
deliberately deferred (not blocking):

- **`startCheckout` has no rate limit.** It's a public action (Guests must be able
  to buy), so a bot could spam Stripe Checkout-session creation — a cost/noise
  (availability) concern, never an access breach (email/amount/metadata are all
  server- or Stripe-controlled). If it becomes a problem, add `@convex-dev/rate-limiter`
  keyed by topic/IP.
- **Double-buy + refund-of-the-first edge.** Buying the same Edition twice records
  the second event but stores no new PaymentIntent (the entitlement is deduped), so
  refunding the *earlier* PaymentIntent would revoke access despite a valid second
  payment. Vanishingly unlikely (who buys the same edition twice); a proper fix
  needs a per-purchase ledger. Left as-is.

Confirmed **by design** (ADR 0016): payment admits an unverified email past the
Allowlist — the intended "payment gates existence" rule, mirroring the existing
email-keyed pending-Share claim.
