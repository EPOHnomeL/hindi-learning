# Paid Course Marketplace — vertical slices

Tracer-bullet slices for the [PRD](PRD.md), following
[ADR 0016](../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md).
Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) (**Seller**, **Entitlement**, **Preview**,
Topic, Guest, Viewer, Public link, Allowlist, Admin, Certificate). Each slice cuts
end-to-end (schema → access → payment → reader → tests) and is demoable on its own;
they are ordered so blockers come first.

The concern-based issues in [`issues/`](issues/) (`02`–`05`) describe the *same work
by layer*; these slices are the *thin end-to-end paths* to build it. The deferred
authoring-cost investigation ([issue 01](issues/01-authoring-cost-and-model-provider-strategy.md))
is research, **not** a slice.

---

## Slice 1 — Paygate skeleton: paid Topic + Preview + Entitlement-gated reading (manual grant)

### What to build

The entire read-side paygate with **no payments at all**. A Topic can be marked
**paid** (it carries a price). A single access resolver decides, in one place, whether
a caller reads the whole course or only the **Preview**, and an **Entitlement** holder
is treated exactly like a **Viewer** (read access, their own **Progress**,
**Certificate** eligibility). A caller with no Entitlement on a paid Topic sees only
the Preview — the lowest-ordered non-superseded Lesson — with the rest clearly
**locked**; **free** Topics behave exactly as today. Entitlements are granted by a
temporary Admin/dev-only mutation so the whole gate is demoable before Stripe exists.

**Prefactor first:** introduce the access resolver as a behaviour-preserving refactor
of today's owner/Viewer gate (existing sharing + public-read tests stay green), *then*
add the paid branches. Make the change easy, then make the easy change.

### Acceptance criteria

- [ ] A Topic can carry a price (amount in minor units + currency); with **no** price it is free and behaves exactly as today.
- [ ] A single access resolver returns the caller's level — `owner | viewer | entitled | preview | none` — and is the **only** place read access is decided; both the authed reader and the Guest reader consult it.
- [ ] Prefactor landed: the resolver preserves current owner/Viewer behaviour (existing tests green) before any paid branch is added.
- [ ] On a paid Topic, a caller with no Entitlement (Guest or signed-in) receives only the **Preview** content plus the table of contents; every other Lesson/Reference returns a **locked** marker distinct from not-found (never a bare 404).
- [ ] The **Preview** is the lowest-ordered non-superseded Lesson.
- [ ] Owner, Viewer, and an **entitled** reader receive the full course; the entitled reader also gets their own Progress and is eligible for a Certificate on completion.
- [ ] A temporary Admin/dev-only mutation grants and removes an Entitlement for a `(user, Topic)` — enough to demo the unlock.
- [ ] An entitled reader still **cannot** record Responses or ask Questions (owner-only, unchanged).
- [ ] Tests: the access-resolver **truth table** across `(owner, viewer, entitled, preview, none) × (paid, free)` — Preview-only vs full content, and free Topics unchanged.

### Blocked by

- None — can start immediately.

---

## Slice 2 — Sellers: Admin "Can Sell" grant + Stripe Express onboarding + pricing

### What to build

The seller side end-to-end, on Stripe **test mode**. The **Admin** grants a User the
**can-sell** capability from the admin portal and can revoke it. A granted user
completes Stripe **Express** onboarding (billing / address / KYC) from inside the app,
and the app learns whether their **payouts** are enabled. A Seller whose payouts are
enabled sets a price on a **finished, published** course; a non-Seller, a Seller
without payouts enabled, and a seeded/unfinished course are all refused. This replaces
the hand-set price from Slice 1 with a real Seller pricing action.

### Acceptance criteria

- [ ] A Sellers relation records the Admin's can-sell grant plus the Stripe connected-account id and its charges/payouts-enabled flags; absence ⇒ "not a Seller".
- [ ] An **Admin-only** action grants and revokes can-sell from the admin portal; revoke stops new pricing but does **not** delete already-sold Entitlements.
- [ ] A granted user starts Stripe Express onboarding in-app (redirected to Stripe's hosted flow); on return, and via account-update, the app persists charges/payouts-enabled.
- [ ] A self query reports seller status: `not-granted | granted-not-onboarded | onboarding-incomplete | ready`.
- [ ] Only a Seller with **payouts enabled** can set a price; a non-Seller, a no-payouts Seller, or a seeded/unfinished course is refused.
- [ ] Setting or clearing a price makes a course paid or free (the flag Slice 1 reads).
- [ ] Tests: can-sell grant/revoke is Admin-only; the pricing guard rejects non-seller / no-payouts / seeded; Stripe mocked at the action boundary.

### Blocked by

- None — can start immediately. (Complements Slice 1: together, a real Seller creates the paid course Slice 1 gates.)

---

## Slice 3 — Purchase: Checkout → automatic Entitlement + buyer account admission

### What to build

The money path end-to-end. A learner on a paid course's **Preview** starts a purchase;
Stripe **Checkout** runs as a **direct charge** on the Seller's connected account with
the platform **application fee**, presenting the price in the buyer's **local
currency**. A **signature-verified webhook** grants access on the *completed* event:
it mints the **Entitlement** if the buyer already has an account, or an **email-keyed
pending Entitlement** that becomes real the moment that email signs up. The
**Allowlist** admission gate is widened to admit an email holding a paid purchase, and
the buyer's account carries **no** selling/authoring privilege. This replaces Slice 1's
manual grant.

### Acceptance criteria

- [ ] A **Buy** action (available to Guests) creates a Stripe Checkout session as a direct charge on the Seller's connected account with the platform application fee; success/cancel return to the course.
- [ ] Prices are presented in the buyer's local currency (Adaptive Pricing).
- [ ] Access is granted **only** by a signature-verified webhook, never from the client success redirect; a bad signature is rejected.
- [ ] On the *completed* event: mint an Entitlement if an account exists for the email, else a pending Entitlement; handling is **idempotent** on the Stripe event id (a replay never double-grants).
- [ ] A pending Entitlement is converted to a real Entitlement on sign-up (the pending-Share claim pattern); the Allowlist gate admits an email with a paid purchase.
- [ ] A buyer account gains **no** can-sell / authoring capability.
- [ ] After purchase the buyer reads the full course, and access persists on re-sign-in and on another device.
- [ ] Tests: signature verification, idempotent mint, account-exists vs pending + claim-on-signup, and admission of a paid email; Stripe mocked at the action boundary.

### Blocked by

- Slice 1 (the access model + locked/unlock reader).
- Slice 2 (a priced course on a payouts-enabled connected account).

---

## Slice 4 — Refund revokes access

### What to build

Close the lifecycle. The purchase webhook handles the **refund** event by revoking the
buyer's Entitlement (or pending Entitlement) idempotently, so the reader falls back to
the paygate and sees only the **Preview** again.

### Acceptance criteria

- [ ] The webhook handles the refund event and deletes the matching Entitlement (or pending Entitlement).
- [ ] Revocation is **idempotent** (a replayed refund is a no-op) and matches the original purchase.
- [ ] After revocation, the formerly-entitled reader sees the paygate again — only the Preview on the paid course.
- [ ] Tests: a refund event revokes access; replay is a no-op. Stripe mocked.

### Blocked by

- Slice 3.
