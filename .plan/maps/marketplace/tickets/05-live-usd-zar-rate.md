---
type: grilling
blocked_by: [03]
---

> `/wayfinder .plan/maps/marketplace/tickets/05-live-usd-zar-rate.md`

# Replace the committed USD→ZAR rate with a live one

## Question

[Donation functionality](03-donation-link-and-prompt.md) put the USD→ZAR rate in a
**committed constant**, changed by deploy — consistent with the landing page it
serves, and accepting one named cost: **it goes stale if nobody watches it.** A
stale rate is not cosmetic here. The donor types dollars and is charged Rand, so a
drifted constant means the "$50" they agreed to and the Rand their bank shows have
quietly diverged — the exact anti-surprise problem the disclosure line exists to
prevent.

Requested at grilling time (2026-08-01) as an explicit follow-up. What needs deciding:

- **Source.** Which FX feed, and is it free at this volume? What are its rate
  limits and its licence terms for commercial use? (This part is a `research`
  question and may want splitting out.)
- **Where the fetch happens.** A rate lookup is a network call, so in Convex it
  must be an **action**, not a query or mutation — and the signed-fields call is
  currently a pure unauthenticated *query* (decision 12 on ticket 03). Does that
  query become an action, or does a scheduled job cache the rate into a row the
  query reads? The cached-row shape keeps the checkout path synchronous and is
  probably the answer.
- **Failure mode.** The feed is down when a donor clicks Donate. Fall back to the
  last cached rate, fall back to the committed constant, or refuse the donation?
  Refusing is the only option that never mischarges and the only one that loses
  money.
- **Staleness bound.** How old may a cached rate be before it is not used? An hour,
  a day, never expires?
- **Rounding and direction.** Round the derived Rand up or down, and to what? A
  consistent direction is worth choosing deliberately rather than inheriting
  whatever `Math.round` does.
- **Whether it should exist at all.** Honest counter-case: at low donation volume a
  human editing one constant when the rand moves may beat a cache, a scheduler, a
  staleness rule and a failure path. If that is the conclusion, rule this out of
  scope and keep the constant.

## Done when

The Answer records: the chosen rate source (or a decision to keep the constant);
where the fetch runs and how the checkout path stays synchronous; the staleness
bound; the behaviour when the feed is unavailable; and the rounding rule — plus the
implementation ticket(s) that follow, or an out-of-scope ruling.
