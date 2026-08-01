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

## Answer

Built `f8b55c3` (its subject line is mangled to a bare `@` — a here-string slip;
the real subject is the first body line). Presentation only, `git diff convex/`
empty.

**One panel, two payment variants.** The purchase states are variants *of*
`Welcome`, as the operator chose — not a banner, not a celebration screen:

- **Payment complete** — eyebrow + a `check` mark in gold, body "your payment
  went through and this course is yours to keep", and the ordinary
  "Start Lesson N" CTA. This is the *happy* path and it is the one that used to
  render nothing.
- **Confirming payment** — the old banner's pulsing gold dot and its copy, moved
  in whole. The start CTA is **withheld**: nothing past the free Preview is
  unlocked yet, and `market.checkoutStatus` is reactive, so the CTA (and the
  content) appear in place the moment the grant lands. No refresh, no timeout
  branch.

Either variant replaces the mission excerpt with its one sentence — a buyer who
has just paid is owed a receipt, not a receipt followed by a course blurb.

**The pick is a pure `welcomeVariant`** in
[welcomeDerive.ts](../../../../src/app/_components/welcomeDerive.ts), tested in
`welcomeDerive.test.ts` (11 cases). Rules, in order: dismissed → nothing;
`?purchase=return&mp=<token>` present and `checkoutStatus` resolved → the
matching payment variant; otherwise the first-open panel. So **the generic
Welcome can never also appear** — one `variant`, one panel.

Three judgements inside it worth keeping:

1. **Not gated on the `firstOpen` latch.** A buyer who read the free Preview
   before paying carries progress, so a `firstOpen`-gated acknowledgement would
   miss exactly the most engaged buyer. The receipt is not orientation.
2. **Undefined status holds the panel back a beat** rather than guessing
   "confirming". Guessing would flash the wrong state at the buyer whose payment
   is already through — the common case, and the whole bug.
3. **A token naming no intent falls through** to the first-open panel. The `mp`
   is a bearer capability off the URL; stale or mangled, there's no purchase to
   acknowledge.

**Dismissal is scoped to the intent token** (`welcome:dismissed:<slug>:paid:<mp>`),
which fixes a hole the ticket didn't name: dismissal is per-tab-session and buying
happens *inside* one session, so a preview reader who dismissed the orientation
panel before clicking Unlock would have come back from PayFast to a panel already
marked dismissed — the same silence, reintroduced. One token, one purchase, one
dismissal.

`ConfirmingBanner` is **deleted**, and with it `Reader.confirmingPaymentTitle`
/ `Body` from all five catalogues; four new `Welcome` keys replace them in
`en/af/es/fr/hi`, parity test green. The EFT rail is untouched — its step 4 is
ticket 16's Awaiting-payment section plus the checkout page's "This course is
yours".

`pnpm typecheck` clean; `pnpm test` 757/758 with only the map's documented
`convex/sales.test.ts` flake failing.

**Still owed: the operator's walk.** Same bar as 13 and 16 — a real card purchase
in dev, checking that the complete variant is what actually appears (not the
confirming one flashing first), and that a buyer who dismissed the orientation
panel pre-purchase still gets acknowledged.

<!-- Filed 2026-08-01 from the operator's dev walk of ticket 13. The correction
     to ticket 12's answer is recorded on the map's Decisions-so-far, not by
     editing 12 — the decision was made in good faith on what was known then. -->
