# 05 — Post-payment sign-up (prefilled + locked email) → claim → own

Status: done

## Parent

[PRD: PayFast Payments](../PRD.md)

## What to build

Close the guest → buy → own loop. After paying, a guest returns from PayFast, creates an
account whose email is fixed to the one they paid with, and immediately owns the course.

- The return page resolves the **checkout-intent** by `m_payment_id` and **prefills and
  locks** the sign-up email to the paid email, so a buyer cannot create a mismatched
  account that fails to claim.
- Sign-up **claims** the pending Entitlement (language-scoped) into a real Entitlement,
  admits the email past the **Allowlist**, and unlocks every Lesson past the Preview.
- If the ITN has not yet landed when the buyer returns, the page reflects a pending state
  and resolves once the pending Entitlement (or claimed Entitlement) exists.

## Acceptance criteria

- [ ] The return page prefills the sign-up email from the checkout-intent and prevents editing it.
- [ ] Signing up with that email claims the pending Entitlement and grants full read access
      to the purchased Edition.
- [ ] A buyer who was already signed in when they paid ends up with the Entitlement directly
      (no claim needed).
- [ ] Claim is language-scoped: claiming an `es` purchase does not unlock `ur`.
- [ ] The buyer's account carries no selling/authoring capability.
- [ ] Claim-on-sign-up tests (matching email grants; the flow admits past the Allowlist) green.

## Blocked by

- [04 — ITN → grant access + write the Ledger](04-itn-grant-access-and-ledger.md)

## Comments

**2026-07-10 (agent)** — Done in `dfd97a8`. `checkoutStatus` (bearer-capability read on
m_payment_id) → awaiting-payment | paid-awaiting-signup | granted; SignIn prefills + locks
the paid email (locked server-side too) and steers the flow; reactive pending state.
Claim-on-sign-up, Allowlist admission, lang-scoping, and no-selling-capability all pinned
by tests; entitled-buyer Certificate eligibility test added in `49eb5c3`.
