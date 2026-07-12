# Sign-up is open; the Allowlist gates course creation; checkout is auth-first

Supersedes the *admission* semantics of
[ADR 0011](0011-allowlist-in-convex-admin-portal.md): anyone may create an
account, and the **Allowlist** now answers "who may **create courses**" instead
of "who may sign up". The portal, the `whitelist` table, the single
non-removable **Admin**, and the normalised `by_email` lookup all stand
unchanged — the list answers a different question. In the same stroke,
checkout becomes **auth-first**: `startCheckout` requires a signed-in caller
and derives the purchase email from the account, and the guest-purchase
machinery (`pendingEntitlements`, claim-on-sign-up, the locked-email sign-up
form, payment-based admission) is deleted.

## Context

Buying was guest-first: the checkout took a *typed* email, and whatever the
buyer typed was what access attached to. Two failures followed:

1. **Email impersonation.** Anyone could pay while typing someone else's
   email; the pending Entitlement then *admitted that email past the
   Allowlist* (ADR 0016's payment-admits widening), and — with no email
   verification — the attacker could sign up AS that address. Payment was an
   open door into the private workspace for an email the payer didn't own.
2. **Typo-stranding.** A buyer who mistyped their own email attached a real
   payment to an unreachable address (no refunds on this rail).

Meanwhile the closed workspace was the wrong gate for a marketplace: buyers
arrive via share links and need accounts, and what actually needs curating is
**Claude generation spend** — course creation — not existence.

## Decision

- **Open sign-up.** `createOrUpdateUser` keeps only normalise + insert +
  pending-**Share** claim. The Allowlist check and the payment-admits check
  die at sign-up; "This workspace is private" dies with them.
- **The Allowlist gates course creation.** `seedTopic` requires the caller's
  account email to be on the Allowlist (`isEmailAdmitted`); the 1/day cap and
  Admin exemption are unchanged. `whitelist.amIAllowlisted` (public, identity
  derived server-side) lets the dashboard hide the seed affordance — the
  server guard remains the boundary. Portal copy flips to "who can create
  courses".
- **Auth-first checkout.** `startCheckout` requires `getAuthUserId` and
  freezes the *account's* (already-normalised) email into the checkout-intent;
  the `email` argument is gone. The buy dialog loses its email field.
  Impersonation-via-checkout and typo-stranding both die at this seam.
- **Buy routing is uniform and deep-linked.** The share reader's Buy CTA links
  to the same Lesson/Reference under `/courses/…?lang=…&buy=1`; signed out,
  SignIn renders at that URL (ADR 0012) defaulting to "Create account";
  signed in, the marker auto-opens the buy dialog over the paygate.
- **Return UX is a reactive banner.** The `CourseIndex` redirect carries the
  query string through; while `purchase=return&mp` is present and
  `checkoutStatus` ≠ `granted`, the reader shows "Confirming your payment…" —
  entitlement queries invalidate when the ITN writes and content unlocks in
  place. No timeout branch.
- **The guest-purchase machinery is deleted.** The `pendingEntitlements`
  table, `hasPendingEntitlement`/`claimPendingEntitlements`, and
  `fulfillPurchase`'s no-account fallback are gone: no account for the intent
  email now **throws**, rolling back the whole transaction *including* the
  `payfastEvents` idempotency row, so PayFast's ITN retry re-runs it whole.
  `checkoutStatus` shrinks to `awaiting-payment | granted` and stops returning
  the intent email (a bearer-token PII leak). Pending **Shares** stay.

## Consequences

- **Accepted interim gap:** password-only sign-up still lets anyone claim an
  unverified email — someone else can squat an address they don't own. The
  purchase, however, attaches to whatever account the *buyer* is signed into,
  so money can no longer be redirected by typing. Email OTP verification
  (Convex Auth email provider + a mail dependency) is the deferred second half
  of the impersonation fix.
- Removing an Allowlist row now revokes course *creation*, not admission;
  sign-up cannot be closed again without reverting this ADR.
- Open sign-up is deliberately un-rate-limited — revisit if abuse appears.
- The money path (signed form POST, intent-anchored ITN verification, Ledger,
  payouts) is untouched.
