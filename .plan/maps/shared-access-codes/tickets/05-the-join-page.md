---
type: task
blocked_by: [04]
---
# The /join page

> `/wayfinder .plan/maps/shared-access-codes/tickets/05-the-join-page.md`

## Question

Where a stranger with a code meets the product. It is a form, and `/redeem` is the prior art for
every structural decision in it, so read `src/app/redeem/` before starting.

**It sits outside the `(app)` group**, on every host, so somebody arriving from a WhatsApp broadcast
meets the code box rather than a sign-in wall. That was the point of the whole rail.

**Two sentences on this page are compliance controls, not copy.** The nickname field must say, in
plain words, that it need not be a real name: that is the POPIA mitigation the design rests on, and
a UI nudging toward a real name removes it. The PIN field must say that a forgotten PIN cannot be
recovered by anybody, because it cannot, and a member who was not told will reasonably believe
support can help.

The consent step comes **before** the nickname box. Consent obtained after the fact is not consent.

## Done when

- `/join` exists on every host, outside `(app)`, and takes a code from the URL as well as the box,
  the way `/redeem` does, so a Seller can hand out a link.
- Three steps on one page: consent, then code, then nickname and PIN.
- The consent step states what is stored and why, in the wording ticket 09 versions, and refusing is
  a real choice that explains what the member can do instead.
- The nickname field says the nickname need not be a real name.
- The PIN field says a forgotten PIN cannot be recovered by anybody.
- All six refusal tags render as translated sentences, never a raw tag and never "Server Error".
- On success the member lands **in the Edition**, not on a success message with nowhere to go.
- **Walked in a browser, signed out**, end to end, including a return on a fresh browser profile and
  each of the six refusals seen on screen.
