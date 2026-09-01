---
type: grilling
blocked_by: [03]
---

> `/wayfinder .plan/maps/marketplace/tickets/06-recurring-monthly-giving.md`

# Recurring monthly giving

## Question

[Donation functionality](03-donation-link-and-prompt.md) shipped **one-off donations
only**, and deferred recurring here on purpose. Monthly giving is the backbone of
mission funding, so this is expected to come back — but it forces answers the
one-off rail never had to give.

**The hard part is cancellation, and it collides head-on with the Guest decision.**
Ticket 03 decided a donor needs **no account and not even an email field** — PayFast
collects the email, the ITN returns it, nothing is persisted before the verified
ITN. An anonymous donor with a live PayFast subscription therefore has **nothing to
sign into and nothing to cancel from**; their only recourse is phoning their bank or
emailing the operator. That is a support burden and a chargeback risk, not a rough
edge.

What needs deciding:

- **How a donor cancels.** A tokenised manage-link emailed at first charge (a bearer
  capability, like a Public link — and with the same leakage properties), or a split
  rule where **one-off stays Guest and monthly is auth-first**? The split rule
  reuses ADR 0021 wholesale and gives a real account to manage the pledge from; it
  costs the impulse-to-pledge conversion.
- **PayFast's actual mechanism.** Subscriptions vs tokenised ("ad hoc") billing —
  which does this account support, what does the recurring ITN stream look like, and
  who initiates each charge? **Research this before grilling the trade-offs**; it
  may constrain the whole shape, the way the MCP direction finding did on 03.
- **Ledger shape over time.** A pledge produces **N rows over months**, not one.
  Does each charge mint its own `kind: "donation"` row (probably — each is money
  owed on its own), and does anything need to tie them to one pledge?
- **Failed and expired cards.** A declined monthly charge is normal, not
  exceptional. Retry, notify, silently lapse? This is the case that generates real
  support mail.
- **The USD-typed amount over time.** The pledge is $25/month but the charge is Rand
  from a constant that will move ([Live USD→ZAR rate](../../technical-foundation/tickets/13-live-usd-zar-rate.md)). Is
  the Rand figure frozen at pledge time forever, or re-derived each month — so the
  donor's statement changes without them doing anything? Neither is obviously right,
  and the donor must be told which.
- **Stopping a pledge when the tenant's flag or payee goes away.** Ticket 03 gates
  the flag on `isReadySeller`. What happens to live pledges when a payee's bank
  details are cleared or the flag is switched off?

## Done when

The Answer records: the cancellation model (and whether monthly becomes auth-first);
the PayFast mechanism confirmed against primary sources; the ledger shape per
charge; the failed-payment behaviour; the frozen-vs-re-derived Rand rule and how the
donor is told; and what happens to live pledges when a tenant's donation config is
withdrawn — plus the implementation ticket(s), or an out-of-scope ruling.
