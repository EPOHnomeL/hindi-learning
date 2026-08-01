---
type: task
blocked_by: [13]
---

# The EFT dead end — a way out, and somewhere to wait

> `/wayfinder .plan/maps/ywampotch-launch/tickets/16-eft-dead-end-and-awaiting-payment.md`

## Question

Found by the operator walking the built checkout page in dev, 2026-08-01.

The bank-details panel is where the EFT buyer *ends*. They read the reference,
transfer the money in their banking app, come back — and there is no button.
Every other terminal state in the funnel completes in the browser; this one
completes in a bank, hours later, and the page had nothing to say about it.

Worse than the missing button: **the app has nowhere that acknowledges the
money at all.** A pending EFT buyer holds no Entitlement — that is the rail's
whole design, access comes only on the operator's confirmation — so
`market.myPurchases` cannot see them, and the overview showed their course under
**Available, at full price**, exactly as if they had never started. Someone who
has just moved R100 out of their account is shown a price tag for it.

Decide and build: where "Done" goes, and what the overview shows while the
transfer is in flight.

## Done when

The instructions panel has an exit. The overview shows the course as awaiting
the transfer, with the reference, and does not also offer it for sale. The state
clears itself when the operator confirms. All five locales. `pnpm typecheck` and
`pnpm test` green.

## Answer

Built in `14b3888`.

**The exit** is a "Done — I've made the transfer" CTA at the foot of the
instructions panel, going to the overview (`/`). Not to the course — the buyer
holds nothing yet — and not back to the reader, which would show them the
paygate they just paid to get past.

**The wait** is a new **Awaiting payment** section on the dashboard, placed
*above* Purchased: a transfer you're waiting on is more urgent than the courses
you already hold, and it must not sit below the fold on a phone. Each card
carries the title, the price and edition, a pulsing "Awaiting EFT" badge, **the
reference restated** (the one thing a buyer may need again, to check against what
they typed into their bank), and a link back to `/checkout/<slug>/<lang>` for the
bank details.

**One new Convex query — `eft.myPendingIntents`.** Read-only, on the EFT rail,
nowhere near the PayFast path. Two decisions inside it worth keeping:

- It rides the **userId prefix of `by_user_topic`**, so no new index and no
  schema change.
- It deliberately **does not return the bank details.** This is a list, not the
  instructions panel; a query behind every dashboard render is the wrong place to
  hand out the operator's account number, and the details already live one click
  away on the checkout page.

**Pending courses are filtered out of Available** — leaving the course in the
discovery grid would offer its price a second time, which reads as "your payment
didn't count".

**Reactive end to end**, and this is what makes it hold together: the intent
leaves `pending` in the same transaction that mints the Entitlement, so on the
operator's confirmation the card leaves Awaiting payment and reappears under
Purchased with no reload — the same mechanism that flips the checkout page to
"This course is yours" (ticket 13).

Not verified in a browser this session: typecheck, build and the full suite are
green, but the operator's walk is the bar.
