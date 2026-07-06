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
