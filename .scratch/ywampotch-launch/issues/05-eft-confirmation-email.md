# ywampotch-launch/05: EFT confirmation email

**Status:** built (2026-07-29)
**Depends on:** [04](04-admin-eft-confirm-queue.md)

## Why

PayFast resolves in seconds; an EFT clears in hours or days, and operator
confirmation may be slower still. The buyer will have closed the tab. If nothing
reaches them, they will conclude they have been robbed — and the operator learns
about it as a support message rather than as a sale.

The in-app pending state ([03](03-buyer-pay-by-eft-intent-and-reference.md))
covers the buyer who is still on the page. Email is the only channel that reaches
the one who left.

## Scope

Exactly **one** send, on confirmation: "your access is live, here's the link".
Via the existing `convex/email.ts` + `convex/inviteEmail.ts` pattern.

- Deep-link straight to the course on the **tenant's own host**, not the apex —
  under ADR 0025 sessions are host-only per subdomain, so a link to the wrong host
  lands the buyer signed out.
- The send must not be able to break confirmation. `email.ts` already no-ops with
  a warning when Resend is unconfigured; keep that property.

## Out of scope

- An "we've recorded your intent" email at click time. It tells the buyer nothing
  they don't already know and doubles the surface for the sake of politeness.
- A receipt/invoice document.
- Any email on dismiss.

## Acceptance criteria

- Confirming an EFT sends one email to the buyer's account address.
- The link opens the purchased Edition on the tenant host the buyer bought from.
- A Resend failure logs and leaves the Entitlement and Ledger row intact —
  confirmation is not rolled back by a bounced email.
- Nothing is sent on a repeat (idempotent) confirm.

## Tests

- Follow the existing invite-email test approach (`convex/invite-emails.test.ts`)
  rather than inventing a second mocking style.
- Assert the no-op-when-unconfigured path, since that is what runs in any
  environment without Resend keys.
