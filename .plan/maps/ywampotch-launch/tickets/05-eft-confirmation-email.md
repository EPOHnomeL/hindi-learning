---
type: task
blocked_by: [04]
---

# EFT confirmation email

## Question

PayFast resolves in seconds; an EFT clears in hours or days, and operator
confirmation may be slower still. The buyer will have closed the tab. If nothing
reaches them, they will conclude they have been robbed — and the operator learns
about it as a support message rather than as a sale. The in-app pending state
([03](03-buyer-pay-by-eft-intent-and-reference.md)) covers the buyer still on the
page; email is the only channel that reaches the one who left.

Scope: exactly **one** send, on confirmation — "your access is live, here's the
link" — via the existing `convex/email.ts` + `convex/inviteEmail.ts` pattern.

- Deep-link straight to the course on the **tenant's own host**, not the apex —
  under ADR 0025 sessions are host-only per subdomain, so a link to the wrong
  host lands the buyer signed out.
- The send must not be able to break confirmation. `email.ts` already no-ops with
  a warning when Resend is unconfigured; keep that property.

Out of scope: an "we've recorded your intent" email at click time; a
receipt/invoice document; any email on dismiss. Follow the existing invite-email
test approach (`convex/invite-emails.test.ts`) rather than inventing a second
mocking style, and assert the no-op-when-unconfigured path.

## Done when

Confirming an EFT sends one email to the buyer's account address; the link opens
the purchased Edition on the tenant host the buyer bought from; a Resend failure
logs and leaves the Entitlement and Ledger row intact (confirmation is not rolled
back by a bounced email); and nothing is sent on a repeat (idempotent) confirm.

## Answer

Built 2026-07-29 (`84d793a`) to the scope above: exactly one Resend send on
confirmation via the existing `email.ts` / `inviteEmail.ts` pattern, deep-linking
to the course on the tenant's own host (ADR 0025 host-only sessions). The send
preserves `email.ts`'s no-op-with-warning behaviour when Resend is unconfigured,
so a Resend failure leaves the Entitlement and Ledger row intact, and a repeat
(idempotent) confirm sends nothing.
