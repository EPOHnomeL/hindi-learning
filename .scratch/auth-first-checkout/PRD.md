# PRD: Auth-first checkout + open sign-up

Status: agreed (grilled 2026-07-12)

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — **Entitlement**, **Edition**,
> **Preview**, **Allowlist**, **Admin**, **Seller**, **Guest**, **Viewer**, **Public link**,
> **Ledger**. Supersedes the *guest-buying* mechanics of
> [`../payfast-payments/PRD.md`](../payfast-payments/PRD.md) (pending Entitlements,
> locked-email sign-up, payment-admits-past-the-Allowlist) — the **money path is
> untouched**: signed form POST, intent-anchored ITN verification, Ledger, payouts all
> stand. Changes the **Allowlist's semantics** (ADR 0011) — recorded in a new ADR 0021.

## Problem Statement

Buying is guest-first today: the checkout takes a *typed* email, and whatever address the
buyer types is what access attaches to. Two failures follow:

1. **Email impersonation.** Anyone can pay while typing someone else's email; the pending
   Entitlement then *admits that email past the Allowlist*, and — with no email
   verification — the attacker can sign up AS that address. Payment is an open door into
   the private workspace for an email the payer doesn't own.
2. **Typo-stranding.** A buyer who mistypes their own email attaches a real payment to an
   unreachable address (no refunds on this rail).

Meanwhile the guest flow carries real machinery — `pendingEntitlements`, claim-on-sign-up,
the locked-email sign-up form, payment-based admission — all to avoid asking for an
account before paying.

## Solution

**Require the account first, and open sign-up to everyone.**

- **Auth-first checkout:** `startCheckout` requires a signed-in caller and derives the
  purchase email from the **account**, never from an argument. The buy dialog loses its
  email field. Impersonation-via-checkout and typo-stranding both die at the seam.
  (Password-only sign-up still lets anyone claim an unverified email — an accepted
  interim gap; email OTP verification is a later bolt-on and out of scope here.)
- **Open sign-up:** `createOrUpdateUser` loses all admission checks. Anyone may create an
  account; buyers arrive via share links (no discovery surface yet).
- **The Allowlist is repurposed as the course-creation gate:** `seedTopic` requires the
  caller's email to be on the Allowlist. Admission to the *app* is free; admission to
  *creating courses* (Claude generation spend) is what the Admin now curates.
- **The guest-purchase machinery is deleted** — `pendingEntitlements` and everything that
  existed only to serve account-less buyers. Pending **Shares** (invites to emails without
  accounts) are untouched.

### The buyer's journey (the flow, end to end)

1. A Guest reads a shared course, hits a locked Lesson/Reference, clicks **Unlock the
   full course**.
2. They are routed to **that same Lesson/Reference under `/courses/…`** with a `buy=1`
   marker (and `lang`). Signed out, that URL shows the sign-in screen **defaulting to
   "Create account"** with purchase-flavoured copy; the toggle still offers sign-in.
   Signed-in visitors take the same route and sail straight through the gate.
3. Authed, they land on the same locked page they came from — paygate behind, **buy
   dialog already open** (the `buy` marker), no email field, price shown. One click to
   PayFast's hosted checkout.
4. After paying, PayFast returns them to the course with a **"Confirming your payment…"**
   banner; the ITN lands seconds later and the Lessons **unlock reactively** — no refresh,
   no sign-up form, no extra steps.

## User Stories

1. As a **Guest** on a Public link, I want Buy to walk me through creating an account *before* payment, so that my purchase attaches to an account I control — not to whatever I typed.
2. As a new buyer, I want the sign-in screen to open on "Create account" when I arrive via Buy, so that the common path has no extra click.
3. As a returning buyer, I want to flip that screen to sign-in, so that my existing account is what buys.
4. As a buyer, I want to land back on the exact locked page I was reading after signing in, with the purchase dialog already open, so that buying never loses my place.
5. As a signed-in buyer, I want checkout to know my email from my account, so that I never re-type it (and can never mistype it).
6. As a buyer returning from PayFast, I want a visible "confirming payment" state and an automatic unlock when confirmation lands, so that a few seconds of ITN latency never reads as a failed purchase.
7. As anyone, I want to create an account without an invitation, so that a share link is all I need to become a buyer.
8. As the **Admin**, I want only Allowlisted emails to create courses, so that open sign-up cannot burn Claude generation.
9. As a signed-in non-Allowlisted user, I want the dashboard to simply not offer "new course", so that I see a clean library rather than a button that errors.
10. As the operator, I want checkout to refuse anonymous callers, so that no payment can ever attach to a free-typed email again.
11. As the operator, I want the ITN to fail loudly (and PayFast to retry) if a paid intent somehow matches no account, so that money is never silently dropped.

## Implementation Decisions

- **`startCheckout` requires auth and derives the email.** The `email` arg is removed;
  the checkout-intent freezes the *account's* (already-normalised) email. The intent
  record and the ITN's intent-anchored verification are otherwise unchanged.
- **Buy routing is uniform and deep-linked.** The share reader's Paygate CTA becomes a
  link to the *same* Lesson/Reference path under `/courses/<slug>/(lessons|references)/<key>?lang=…&buy=1`
  — never a dialog on the share page. Signed out, AppGate renders SignIn at that URL
  (ADR 0012 deep-link behaviour, no redirect); signed in, the page renders directly.
  Landing on the exact page avoids the `/courses/<slug>` root redirect entirely for the
  buy path.
- **The `buy` marker auto-opens the dialog.** On the authed reader, `buy=1` +
  `preview`-level access opens the BuyDialog over the Paygate. Any holder
  (owner/viewer/entitled) renders unlocked content and the marker is ignored.
- **SignIn defaults to sign-up on the buy marker.** `buy=1` → flow starts at
  "Create account" with copy like "Create an account to complete your purchase — already
  have one? Sign in". Without the marker, the default stays "Sign in". The
  private-workspace copy and the locked-email mode are deleted.
- **Open sign-up.** `createOrUpdateUser` keeps only normalise + insert + pending-**Share**
  claim. `whitelist.isAdmitted`'s role in auth dies; the "This workspace is private" error
  dies.
- **Return UX is a banner over the reader, reactive unlock, no timeout branch.** PayFast's
  return URL still points at `/courses/<slug>?purchase=return&mp=…`; the `CourseIndex`
  root redirect must **carry the query string through** `router.replace` (today it drops
  everything but `lang` — the banner would never show). While `purchase=return&mp` is
  present and `checkoutStatus` ≠ `granted`, the reader shows "Confirming your payment —
  this usually takes a few seconds"; entitlement queries invalidate when the ITN writes,
  and the content unlocks in place. The sandbox-verified norm is seconds; support owns
  the freak case (ponytail: no stalled-payment branch).
- **Delete the guest-purchase machinery.**
  - `pendingEntitlements` table (schema drop — prod marketplace tables are empty; dev has
    no pending rows) and `fulfillPurchase`'s no-account fallback branch: it **throws**
    instead. A throw rolls back the whole transaction *including* the `payfastEvents`
    idempotency row, so PayFast's ITN retry re-runs it whole — nothing is silently lost.
  - `hasPendingEntitlement` + `claimPendingEntitlements` (`lib.ts`) and their use in auth.
  - `checkoutStatus` shrinks to `awaiting-payment | granted` and **drops the `email`
    field** — no remaining consumer, and returning it via a bearer-token query was a
    small PII leak.
  - `pendingShares` + `claimPendingShares` (invites) **stay**.
- **The Allowlist gates course creation.** `seedTopic` requires
  `isEmailAdmitted(caller's account email)`; the existing 1/day limit and Admin exemption
  are unchanged. A small public query exposes the caller's membership so the dashboard
  hides the seed affordance for non-members (server guard remains the boundary). Naming:
  the glossary avoids **Creator**/**Author** — name the query after Allowlist membership
  (e.g. `whitelist.amIAllowlisted`), and keep "Allowlist" as the term; UI copy may say
  "who can create courses".
- **Admin portal copy** flips from "who may sign up" to "who may create courses"; the
  non-removable-Admin guard and `isAdmin` flag are untouched (Admin still governs the
  Allowlist — the list now answers a different question).
- **Docs:** ADR **0021** records the semantics change (supersedes ADR 0011's
  sign-up-gate meaning; the portal/table mechanics stand). CONTEXT.md: the **Allowlist**
  entry is redefined (set of emails permitted to *create courses*; sign-up is open), the
  Monetisation "reshaping" bullet ("buyers are admitted by payment") dies, and the
  pending-Entitlement bullet dies with the table. *(Note: main already has ADR 0020 —
  Editor role; number accordingly at merge.)*

## Testing Decisions

**What makes a good test here:** assert behaviour at the seams — what a caller may do,
what state a query returns, what a verified ITN produces — never UI internals. Prior art:
the existing `auth`/`whitelist`/`market`/`purchase` test files, which these changes edit
in place.

- **Seam — sign-up (auth.test.ts).** An email with *no* Allowlist row signs up
  successfully (the old closed-workspace test inverts); pending **Shares** still claim on
  sign-up; the pending-Entitlement claim tests are deleted with the machinery.
- **Seam — checkout (market.test.ts).** Unauthenticated `startCheckout` throws; a
  signed-in caller's checkout-intent carries the **account** email (no arg accepted —
  compile-level plus a runtime assertion on the intent row); the rest of the signed-field
  and gating tests stand unchanged.
- **Seam — fulfilment (purchase.test.ts).** `fulfillPurchase` with an intent email that
  matches no account **throws and persists nothing** (no entitlement, no ledger row, no
  `payfastEvents` row — the retry-ability invariant); the account-exists path is
  unchanged; pending-Entitlement tests die.
- **Seam — return state (market.test.ts).** `checkoutStatus` returns
  `awaiting-payment` before the ITN and `granted` after, and its shape carries **no
  email**.
- **Seam — course creation (content tests).** A signed-in non-Allowlisted user's
  `seedTopic` throws; an Allowlisted member seeds; the 1/day limit and Admin exemption
  hold as before; the membership query answers true/false by Allowlist row.
- **Redirect param-carry.** The `CourseIndex` redirect preserving `purchase`/`mp` is
  pinned wherever cheapest (unit test on the URL builder if extracted, else noted as a
  manual verify step) — it is the one regression that silently kills the banner.

## Out of Scope

- **Email OTP verification** (the deferred half of the impersonation fix — Convex Auth
  email provider + a mail dependency, e.g. Resend).
- **Password reset / OAuth providers** — password-only stands.
- **A discovery surface / marketplace catalogue** — buyers arrive via share links.
- **Naming the buyer role**; per-buyer Responses/Questions (buyer keeps Viewer semantics).
- **Any change to the money path** — signing, ITN verification, Ledger, payouts, pricing.
- **Rate-limiting sign-up itself** — open means open; revisit if abuse appears.

## Further Notes

- **Sequencing:** the deletions (issue 05) must land *after* auth-first checkout
  (issue 02) — until checkout stops accepting guests, the pending-Entitlement path is
  still load-bearing. All of it ships on `feat/paid-marketplace` before PR #3 merges,
  so the intermediate states are branch-internal.
- The full guest-journey sandbox test from the predecessor's handoff becomes moot once
  this lands; the replacement live test is the auth-first journey (sign up → buy → ITN →
  reactive unlock) on the sandbox.
