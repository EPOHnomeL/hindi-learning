# PRD: Paid Course Marketplace (Stripe Connect)

Status: ready-for-agent

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — **Seller**, **Entitlement**,
> **Preview**, **Edition**, plus Topic, Guest, Viewer, Public link, Allowlist, Admin,
> Certificate. Direction: [ADR 0016](../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md).
> Also respects [ADR 0001](../../docs/adr/0001-asynchronous-hub-mediated-teaching-loop.md)
> (no LLM in the web app), [ADR 0011](../../docs/adr/0011-allowlist-in-convex-admin-portal.md)
> (Allowlist / Admin portal), [ADR 0013](../../docs/adr/0013-public-link-shares.md)
> (Public link), and [ADR 0015](../../docs/adr/0015-course-completion-and-certificates.md)
> (account-bound Certificates). Deferred economics: [issue 01](issues/01-authoring-cost-and-model-provider-strategy.md).
>
> **Depends on the course-translation feature.** What is sold is an **Edition** — a
> `(Topic, language)` pair, the unit of content access it introduces — so a course is
> bought and priced *in a specific language*. That feature already makes **Shares
> language-scoped** and **Public links per-Edition**; this PRD adds the paid twin. It
> should land first (or this work rebases onto it): the schema and read seams below
> are shared with it.

## Problem Statement

Today every course is given away. A Topic's owner can **Share** it (an account-bound
grant to a Viewer) or mint a **Public link** (anonymous Guest access), and both hand
over the *whole* course for free. There is no way for a person to sell a course they
authored, no way for them to be paid, and no way for a learner to pay for access.

Three things stand in the way of a marketplace where a vetted **Seller** lists a
finished course and a learner reads the first lesson free, then pays once for the
rest:

1. **Access is all-or-nothing and always free.** It is decided by ownership, a
   Share, or a Public link — never by a purchase.
2. **Nobody can sell.** No User can price a course, connect a payout account, or
   receive money.
3. **The public can't buy.** Sign-up is gated by the **Allowlist** (the private-alpha
   admission gate), so a stranger can neither create an account nor hold a purchase.

## Solution

A paid **marketplace** layered on top of the existing free model, per
[ADR 0016](../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md):

- What is sold is an **Edition** — a `(Topic, language)` pair. Each Edition is
  **free or paid at the Seller's choice**, priced **independently**: an Edition with
  **no price** is free and behaves exactly as it does today (its language-scoped Share
  and per-Edition Public link unchanged); an Edition with a **price** is paid — its
  first Lesson (in that language) is the free **Preview**, and everything past it
  requires an **Entitlement** for that Edition.
- A trusted User is made a **Seller** in two steps: the **Admin** grants a *can-sell*
  capability, and the Seller completes Stripe onboarding (billing and address / KYC).
  Only a Seller whose payouts are enabled may price an Edition, and only on a
  finished (completed) course.
- A learner reads the **Preview** of the language they want, pays once in their local
  currency, and receives a one-time **lifetime Entitlement** to *that Edition* —
  unlocking every Lesson past the Preview plus its **References**, in that language.
  Buying the Spanish Edition does not unlock the Urdu one. The platform
  **facilitates** the payment and takes a cut; the Seller remains the **merchant of
  record**.
- **Payment admits the buyer.** A successful purchase provisions an account for the
  buyer's email, bypassing the **Allowlist** — which is redefined to gate *selling*,
  not *existence*. A buyer's account carries no selling or authoring privilege.
- A paid course must be **fully authored and published before it can be listed**, so
  no learner ever pays to continue into a Lesson that does not yet exist.

## User Stories

1. As an **Admin**, I want to grant a User the *can-sell* capability from the admin
   portal, so that a trusted User can begin selling courses.
2. As an **Admin**, I want to revoke a User's *can-sell* capability, so that I can
   stop them listing new paid courses without disturbing courses they have already
   sold.
3. As a granted **Seller**, I want to complete Stripe onboarding (billing and address
   / KYC) from inside the app, so that I can receive payouts.
4. As a **Seller**, I want to see my onboarding status (not granted, granted but not
   onboarded, onboarding incomplete, ready), so that I know whether I can price a
   course yet.
5. As a **Seller**, I want to set a price (amount and currency) on a finished,
   published course, so that learners can buy access to it.
6. As a **Seller**, I want to be prevented from pricing a course until my payouts are
   enabled, so that I never list something I cannot be paid for.
7. As a **Seller**, I want to be prevented from pricing a course that is not yet fully
   authored and published, so that a buyer is never stranded mid-course.
8. As a **Seller**, I want to change or remove a course's price, so that I can adjust
   it or make the course free again.
9. As a **Seller**, I want my payout to be the sale amount minus the platform's cut,
   applied automatically, so that I do not have to reconcile fees by hand.
10. As a **Seller**, I want to remain the merchant of record for my own sales, so that
    the tax obligation and the customer relationship are mine.
11. As a **Seller**, I want to keep offering **free** courses over Share and Public
    link exactly as before, so that monetisation is opt-in per course.
12. As a **Guest**, I want to read the first Lesson (the **Preview**) of a paid course
    without paying, so that I can judge its quality before buying.
13. As a **Guest**, I want the locked Lessons to be clearly presented as "buy to read"
    rather than missing or broken, so that I understand I need to purchase.
14. As a **Guest**, I want to buy lifetime access with a card, so that purchasing is
    quick and needs no prior account.
15. As a buyer, I want prices shown in my local currency, so that the cost is legible.
16. As a buyer without an account, I want an account created for my email as part of
    buying, so that my purchase is durable and attributable.
17. As a buyer, I want to set a password and sign in after buying, so that I can return
    to the course later.
18. As a buyer, I want every Lesson past the **Preview** plus its **References**
    unlocked **forever** after paying, so that I receive what I paid for.
19. As a buyer, I want my access to work when I sign in on another device, so that I am
    not tied to the device I bought on.
20. As a buyer, I want to track my own **Progress** through a paid course, so that I can
    see where I am, like any other reader.
21. As a buyer who finishes a paid course, I want to earn a **Certificate**, so that I
    have proof of completion on the platform.
22. As a buyer, I want a refund to cleanly revoke my access, so that a refund is honest
    on both sides.
23. As a member of the public, I want to buy a course from a **Seller** who never
    invited me, so that I do not need a personal invitation to purchase.
24. As a member of the public, I want buying to let me create an account even though
    sign-up is otherwise gated by the **Allowlist**, so that I can purchase without
    being hand-admitted by the Admin.
25. As a buyer whose email had a purchase before they signed up, I want that purchase to
    become active the moment I create my account, so that timing never loses my access.
26. As the operator, I want a buyer's account to carry **no** selling or authoring
    privileges, so that buying can never escalate into the ability to sell.
27. As the operator, I want the **Allowlist** to keep gating who may sell (through the
    *can-sell* grant), so that only vetted people can list courses.
28. As the operator, I want access granted **only** on a verified Stripe webhook event,
    never on a client-side redirect, so that access cannot be spoofed.
29. As the operator, I want webhook events handled idempotently, so that a replayed
    event never double-grants or double-revokes access.
30. As a **Guest** on a paid course's **Public link**, I want to see the **Preview** and
    the table of contents but not the paid Lesson content, so that the link is a useful
    teaser without leaking the product.
31. As an owner of an existing **free** course, I want it and its **Public link** to
    behave exactly as they do today, so that introducing the marketplace does not
    regress current sharing.
32. As a buyer, I want an **Entitlement** to give me the same read access a **Viewer**
    has — Lessons, References, and my own Progress — so that a paid reader is a
    first-class reader, not a special case.
33. As a **Seller**, I want to choose which language **Editions** of my finished course
    to sell and price each one independently, so that I can, say, offer the Spanish
    Edition at a different price from the English original — or not sell some languages
    at all.
34. As a buyer, I want to see which language **Editions** of a course are for sale and
    at what price, so that I can buy the one I want to learn in.
35. As a buyer, I want to read the free **Preview** in the language of the Edition I am
    considering, so that I judge the translation quality before paying for that Edition.
36. As a buyer, I want my **Entitlement** scoped to the Edition I bought, so that buying
    the Spanish Edition unlocks Spanish — and if I later want Urdu, I buy that Edition
    too.
37. As a buyer who finishes a paid **Edition**, I want my **Certificate** to record the
    language I completed in, so that the proof reflects the Edition I actually studied.

## Implementation Decisions

- **Free-or-paid is a property of the Edition, not the Topic.** Each sellable
  **Edition** `(Topic, language)` carries an optional price (amount in minor units +
  currency), stored per `(Topic, language)`. **Price present ⇒ that Edition is paid;
  absent ⇒ free.** A Seller may price some languages and leave others free/unsold.
- **Access resolves at one seam, at the Edition grain — extending the
  course-translation feature's per-Edition gating.** That feature already decides who
  *holds* an Edition (owner, language-scoped Share, per-Edition Public link); this
  feature adds **one more holder: an Entitlement**. The resolver returns, for a
  requested Edition, `owner | viewer | entitled | preview | none`, and an entitled
  holder is treated as a **Viewer** of that Edition everywhere — read access, their own
  **Progress** (per-Topic), and **Certificate** eligibility — with no per-surface
  change. The **Preview gate** (a paid Edition shows only its Preview to a caller who
  does not hold it) is the *only* new read branch; the authed reader and the Guest
  reader both consult the one resolver.
- **Preview = the lowest-ordered non-superseded Lesson of the requested Edition**
  (that language's rendering), using the same non-superseded filter the **Frontier**
  uses; it falls back to the English source per the translation feature's rules.
- **The Entitlement is a stored relation**, one row per **(buyer, Topic, language)**,
  permanent (one-time, lifetime); the presence of the row *is* access to that Edition.
- **Buyer admission mirrors the language-scoped pending-Share pattern.** A purchase
  mints an **email-keyed pending Entitlement carrying the `lang`** that is converted
  into a real Entitlement the moment that email has an account, by a claim step invoked
  from the sign-up callback (the twin of the existing pending-Share claim, which is now
  itself language-scoped). The **Allowlist** admission gate is widened to admit an email
  that holds a paid purchase. A buyer account gains **no** sell/author capability.
- **Selling is a capability, modelled as a Sellers relation** holding the Admin
  *can-sell* grant plus the Stripe connected-account id and its `chargesEnabled` /
  `payoutsEnabled` flags. The grant is distinct from onboarding completion, and
  CONTEXT's **Seller** requires both.
- **Pricing is per Edition.** A separate listing records the price for a
  `(Topic, language)` Edition; a Seller sets/clears each independently and may sell
  only some languages. Pricing is guarded on `payoutsEnabled` **and** a `completed`
  course (an Edition only exists to sell once the course is finished — and
  translation itself is gated to completion by the course-translation feature).
- **Payments use Stripe Connect with Express connected accounts and direct charges plus
  an application fee.** The Seller is the merchant of record and bears Stripe fees;
  the platform takes the application fee. Local-currency presentment uses Adaptive
  Pricing.
- **The purchase is granted by a signature-verified Stripe webhook**
  (`checkout.session.completed`) and revoked on refund; an idempotency ledger dedupes
  replays. Stripe SDK calls live only in Convex actions / HTTP actions, never in a
  query. Access is never granted from the client success redirect.
- **No LLM runs in the web app** (ADR 0001). **Who funds up-front authoring is
  deferred** ([issue 01](issues/01-authoring-cost-and-model-provider-strategy.md)); it
  affects economics, not access mechanics, so it does not block this spine.
- **The take-rate (application-fee %) and refund policy** (window; whether the
  application fee is returned on a refund) are configuration/business decisions, not
  architecture. They must be chosen before wiring checkout, but they do not change the
  seams.

## Testing Decisions

**What makes a good test here:** assert external behaviour at a seam — the access a
caller gets, and the effect of a purchase/refund event — never implementation detail,
UI, or styling. Stripe is mocked at the action boundary; no test calls Stripe.

- **Seam 1 — the access resolver (primary, the only new logic).** Test the
  Edition-aware resolver as a **truth table** across `(owner, viewer, entitled,
  preview, none) × (paid, free)` **for a requested Edition**: on a paid Edition an
  unentitled caller (Guest or signed-in) gets **only that Edition's Preview** content
  and a "locked" marker for the rest (never a bare `null` that reads as 404), while
  owner, language-scoped Viewer, and entitled callers get everything in that language;
  a **free** Edition is unchanged. Assert Edition-scoping: an Entitlement for `es` does
  **not** unlock `ur`. Prior art: the course-translation per-Edition read tests, the
  read-only sharing tests, and the Guest public-read tests.
- **Seam 2 — the purchase lifecycle.** Test the webhook + claim: a bad signature is
  rejected; a `checkout.session.completed` event mints access **once** and is
  idempotent on replay; when an account exists it mints an Entitlement, and when it
  does not it mints a pending Entitlement that is claimed on sign-up; a refund event
  revokes. Prior art: the pending-Share claim-on-sign-up tests and the secret-guarded
  HTTP-action / report tests.
- **Seam 3 — seller gating.** Test that a non-Seller cannot price; a Seller without
  `payoutsEnabled` cannot price; a seeded/unfinished course cannot be priced; and the
  *can-sell* grant and revoke are Admin-only. Prior art: the Allowlist admission tests
  and the owned-topic guard tests.
- **The entitled-≡-Viewer invariant.** Assert a buyer gains a Viewer's read access and
  their own Progress + Certificate eligibility, but **cannot** record Responses or ask
  Questions (those stay owner-only and must be unaffected).

## Out of Scope

- **Who funds authoring / BYOK / model gateway / Gemini** —
  [issue 01](issues/01-authoring-cost-and-model-provider-strategy.md).
- **Subscriptions, per-lesson sales, coupons, bundles.**
- **True purchasing-power-parity price tiers** — v1 does local-currency *presentment*
  (Adaptive Pricing) only, not region-discounted prices.
- **Payouts to Sellers in Stripe-unsupported / non-cross-border countries** — a hard
  limit on who can sell, not something this PRD removes.
- **Reviews / ratings, a marketplace discovery catalogue, and self-service refund UI**
  beyond an operator/Seller revoke.
- **Naming the buyer role** — deferred to the roles/enrollment work; the buyer is
  defined operationally as "a User holding an Entitlement".
- **Per-buyer Responses / Questions** — a buyer gets Viewer semantics (read + own
  Progress); Responses and Questions stay owner-only until enrollment lands.

## Further Notes

- The **take-rate** and the **refund policy** are the two open business decisions;
  they are config, not architecture, and were flagged as unresolved in the grilling
  session that produced this PRD. Pick them before wiring the checkout slice.
- Extending the resolver to entitled callers is what makes a buyer able
  to earn a **Certificate** ([ADR 0015](../../docs/adr/0015-course-completion-and-certificates.md))
  — a deliberate, free consequence of the entitled-≡-Viewer decision, not a special
  case. The Certificate already snapshots the Edition's `lang`, so a buyer's proof
  reflects the language they completed in with no extra work.
- **Dependency & ordering:** this rides the course-translation feature's Edition model
  (language-scoped Shares, per-Edition Public links, per-Edition read gating). That
  feature must land first, or this branch rebases onto it — they share `schema.ts` and
  the read seams. Building against the pre-Edition schema would have to be redone.
- **Translation cost coupling:** translated Editions are produced on the *operator's*
  Claude key. Selling a translated Edition therefore has a cost the platform's cut must
  recoup — this joins the deferred authoring/translation economics
  ([issue 01](issues/01-authoring-cost-and-model-provider-strategy.md)).
- **Build order:** the Entitlement model + access seam first (unblocked); then the
  *can-sell* grant + Stripe onboarding and the pricing/checkout/webhook (both need
  Stripe provisioning and the two business decisions); then the read-seam fork +
  Preview gate. The authoring-cost investigation is parked and blocks nothing.
