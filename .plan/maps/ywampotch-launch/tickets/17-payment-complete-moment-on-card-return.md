---
type: task
blocked_by: [13]
---

# The card buyer's payment-complete moment

> `/wayfinder .plan/maps/ywampotch-launch/tickets/17-payment-complete-moment-on-card-return.md`

## Question

Found by the operator completing a **real** PayFast purchase in dev, 2026-08-01.

**Ticket 12 recorded the payment-return landing as already correct, and it is
not.** Its answer said the card buyer "lands on the course with `CourseShell`'s
reactive `ConfirmingBanner`, which *is* step 4 and is already correct from the
new route." That holds only while the ITN is in flight.

`ConfirmingBanner` ([CourseShell.tsx:369](../../../../src/app/_components/CourseShell.tsx))
reads `if (!mp || !status || status.state === "granted") return null` — it exists
for the *pending* case only. The ITN lands in seconds, so by the time the browser
is back from PayFast the entitlement is usually already written, the banner
renders nothing, and **the faster the payment succeeds the less the buyer sees.**
There is a "confirming your payment" state and no "payment complete" state.

What fills the vacuum is the generic first-open **Welcome** panel, which fires
precisely because a fresh buyer has no progress yet. So the first screen after
paying is a course intro over a loading skeleton, with nothing anywhere
acknowledging that money changed hands.

**Shape chosen by the operator:** a purchase variant of the Welcome panel, not a
banner and not a separate celebration screen — one panel owning the moment
instead of two competing for it.

## Done when

A card buyer returning from PayFast sees the purchase acknowledged, in the panel
that already owns that moment, whether the ITN has landed or is still in flight.
The generic Welcome panel does not also appear. The EFT rail is unaffected (its
step 4 is ticket 16's, plus the checkout page's own "This course is yours"). All
five locales. `pnpm typecheck` and `pnpm test` green, and the operator has walked
it.

<!-- Filed 2026-08-01 from the operator's dev walk of ticket 13. The correction
     to ticket 12's answer is recorded on the map's Decisions-so-far, not by
     editing 12 — the decision was made in good faith on what was known then. -->
