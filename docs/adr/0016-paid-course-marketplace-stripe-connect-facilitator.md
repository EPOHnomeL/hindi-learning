---
status: proposed
---

# Paid course marketplace: Sellers sell, platform facilitates via Stripe Connect (not merchant of record)

Status: proposed (product-direction decision from the 2026-07-06 grilling session)

A paid **marketplace** is added on top of the free-distribution model: vetted
**Sellers** list finished courses *in specific languages*, buyers purchase a
one-time lifetime **Entitlement** to one **Edition** (a `(Topic, language)` pair;
first Lesson free, then pay to continue), and the platform **facilitates** payments
through **Stripe Connect (Express)** — taking an application fee while each Seller
remains the **merchant of record** for their own sales. This is the first time the
platform charges for *consuming* content, inverting the roadmap's "serving is free,
money is in authoring" assumption for paid courses. It **builds on the
course-translation feature's Edition model** — selling is scoped to an Edition, the
same grain as its language-scoped Shares and per-Edition Public links.

## Context

[ADR 0014](0014-provider-agnostic-teaching-runtime-two-lines.md) and the
[roadmap](../../.scratch/product-direction/ROADMAP.md) monetise the *studio*
(B2B): serving a finished course to N readers is ~free; the cost lives in
authoring. This ADR adds the opposite shape — a **B2C paygate** that charges the
*learner* for consuming an already-authored course.

That collides with three shipped concepts:

- **Guest / Public link** ([ADR 0013](0013-public-link-shares.md)) grant
  *anonymous, full, free* read of a whole Topic. A paygate makes access
  **entitlement-gated**, not "hold the token → read everything".
- **The Allowlist** ([ADR 0011](0011-allowlist-in-convex-admin-portal.md)) gates
  account creation to a private-alpha list — incompatible with selling to the
  public, who must be able to buy without the Admin hand-admitting each one.
- **Progress / Certificates** require accounts; a **Guest**'s state is
  browser-only. A purchase-like right therefore *must* attribute to an account
  (the same conclusion [ADR 0015](0015-course-completion-and-certificates.md)
  reached for Certificates).

## Decision

- **Marketplace, not first-party.** Sellers sell *their own* courses; the platform
  facilitates and takes a cut. (The operator does not sell its own catalogue.)
- **Facilitator, not merchant of record.** Each Seller is the merchant of record
  for their sales and owes their own tax; the platform is a **Stripe Connect**
  facilitator taking an `application_fee`. A single-MoR provider (Paddle / Lemon
  Squeezy / Polar / Gumroad) was rejected — those handle global VAT/GST for
  *your own* products but do not run a third-party marketplace, and would make the
  platform the seller of record for everyone.
- **Stripe Connect · Express accounts · direct charges + application fee.**
  Stripe-hosted KYC embedded in the app; the platform controls charge types and
  payout timing; the Seller bears processing fees. (Standard was the lower-effort
  alternative; Express was chosen for payout/onboarding control.)
- **Selling is a two-gate capability.** The **Admin** grants a per-user
  **can-sell** flag in the admin portal (distinct from Allowlist admission), and
  the Seller then completes Stripe Express onboarding (billing + address / KYC)
  before they can charge. On the Allowlist = you may *exist*; can-sell = you may
  *charge*.
- **Unit of sale: a one-time, lifetime Entitlement per Edition — `(buyer, Topic,
  language)`.** It unlocks every Lesson past the free first one plus their
  References, *in that Edition's language*. The Entitlement is the **paid
  counterpart to a language-scoped Share**, and like a Share is scoped to one
  Edition (buying the Spanish Edition does not unlock the Urdu one). Subscription
  was rejected (churn/dunning/revocation fights the immutable-Lesson + Certificate
  model — what happens to an earned Certificate when access lapses?); per-lesson
  à la carte was rejected (a checkout every Lesson is high friction for a
  sequential course).
- **Price is per Edition, not per Topic.** A Seller chooses which language Editions
  of a finished course to sell and prices each independently; an Edition with no
  price is not for sale. (Rejected: one Topic price for any/all Editions — it
  doesn't express "sell in a specific language" and breaks the per-Edition access
  grain the course-translation feature established.)
- **First Lesson is the free Preview, per Edition.** A Guest / unpaid visitor reads
  the first Lesson *in the Edition's language*; continuing requires a buyer account
  + an Entitlement for that Edition.
- **Payment admits buyers; the Allowlist is redefined to gate *selling*, not
  *existence*.** A successful purchase auto-creates an account for the buyer,
  bypassing the Allowlist (which stays the gate for who may sell). This is the
  Author/Learner role split anticipated in
  [ADR 0014](0014-provider-agnostic-teaching-runtime-two-lines.md) Phase 1.
- **A paid course must be fully authored and published *before* listing.**
  On-demand, buyer-triggered authoring ([ADR 0008](0008-next-lesson-routine-gate-in-convex.md))
  is incompatible with a paygate: you cannot sell "continue" when the next Lesson
  does not exist, nor fire a paid authoring run on a *buyer's* completion. The
  roadmap's publish gate becomes **mandatory** for paid courses; serving the
  finished course stays cheap.
- **Who funds the up-front authoring is deferred** (the owner will monitor real
  authoring cost first). The options — Seller-BYOK (cut = pure margin),
  operator-funded (recoup via cut), operator-funded-metered — and the related
  model-provider investigation (BYOK, OpenRouter gateway + Browserbase, Gemini)
  are parked in
  [paid-marketplace issue 01](../../.scratch/paid-marketplace/issues/01-authoring-cost-and-model-provider-strategy.md).
  The funding choice affects *economics*, not the *access mechanics*, so it does
  not block the paygate spine.

## Considered options

- **Platform as first-party seller** (rejected): the owner wants a marketplace of
  many Sellers, not a single-vendor catalogue.
- **Platform as single merchant of record + revenue-share** (rejected): chose the
  facilitator model so each Seller owns their own tax; MoR providers also don't
  support arbitrary third-party marketplaces.
- **Subscription / per-lesson units** (rejected): see the unit-of-sale decision.
- **Magic-link entitlement with no real account** (rejected): sidesteps the
  Allowlist but fights the account-based Progress and Certificate models — a
  second-class identity everywhere else.

## Consequences

- **A genuinely new surface**: an `Entitlement` relation, a checkout flow, Stripe
  Connect onboarding + webhooks, payouts, and **refunds** (refund → revoke the
  Entitlement; on Connect direct charges a refund reduces the Seller's balance and
  must decide the application-fee treatment).
- **Public buyers break the private-alpha assumption.** Account creation is no
  longer Allowlist-gated for buyers; the abuse surface grows; the Admin's
  governance shifts to gating **Sellers** (the can-sell grant).
- **Read seams fork on paid-vs-free + Entitlement, at the Edition grain.** The
  course-translation feature already gates reads per Edition (owner, language-scoped
  Share, per-Edition Public link); this feature **adds one more way to hold an
  Edition** — an Entitlement. A free Edition keeps its anonymous access; a paid
  Edition exposes only its Preview until the caller holds an Entitlement for it.
- **Depends on the course-translation feature (Editions).** This design assumes the
  language-scoped Share, the per-Edition Public link, and the per-Edition read
  gating are in place. Course-translation should land first, or this branch must
  rebase onto it — the schema and read seams it edits are that feature's.
- **Translation is operator-funded, so a sold translated Edition has a cost the cut
  must recoup.** Translation runs on the operator's Claude key (gated to `completed`
  courses). When a Seller sells a *translated* Edition the operator paid to produce,
  the application fee must cover that cost — folded into the deferred economics
  ([issue 01](../../.scratch/paid-marketplace/issues/01-authoring-cost-and-model-provider-strategy.md)).
- **International reach is asymmetric.** Buyers pay in local currency via Stripe
  **Adaptive Pricing** (150+ countries; currency *presentment* only, not PPP
  discounting). Seller **payouts** are limited to Stripe-supported +
  cross-border-payout countries (expanding through 2026) — a hard gate on who can
  *sell* internationally even though anyone can *buy*. True PPP pricing needs
  explicit per-region price tiers and, in the facilitator model, is **per-Seller**.
- **Certificates now presuppose an Entitlement** on a paid course, but remain
  per-account and otherwise unchanged.
- **Role naming.** "Seller" was chosen over "Author" (which collides with the
  Routine *authoring* Lessons); the buyer role is left unnamed (it would collide
  with the generic "learner") until the roles/enrollment work lands.
