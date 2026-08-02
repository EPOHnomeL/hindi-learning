---
type: grilling
blocked_by: [10]
---
# Set the evidence bar

> `/wayfinder .plan/maps/ui-overhaul/tickets/12-set-evidence-bar.md`

## Question

How much evidence is enough before ticket 13 can name and rank the clunky flows?

Deliberately deferred on 2026-08-02: at the time of charting nobody knew whether a
week of instrumentation would yield 5 sessions or 50, and inventing a number cold
would have been theatre. Once ticket 10 has been live for roughly a week, the real
arrival rate is a fact — set the bar against it.

**The volume reality this must respect.** Lifetime sales are around **ten**. Funnel
percentages and drop-off rates are therefore statistically meaningless — one
confused visitor swings a "30% drop-off" — and a bar phrased as "N thousand events"
would never be met. The value at this volume is **replay**: few enough sessions that
every single one can be watched individually, which is a luxury high-traffic
products do not have. Build funnels anyway, but treat them as navigation *into*
replays, never as statistics.

Decide:

- The bar itself — most likely a **time window plus a session count** ("every
  recorded session over N weeks watched, at least M real sessions"), not a
  percentage or a confidence level.
- Whether a self-walkthrough on a real phone supplements it, and if so how findings
  from it stay **labelled** as the author's guess rather than a user's observation.
  Grilling flagged the risk: two evidence sources of very different quality feeding
  one decision, where an untagged guess quietly becomes an observation.
- A stop rule — the date at which 13 proceeds on whatever evidence exists, so a thin
  trickle of traffic cannot stall the map indefinitely.

## Why this ticket exists at all

It is the mitigation for a drift risk the user accepted knowingly. An open ticket
with no Done-when drifts for months; this converts "set the bar later" from a vague
intention into a scheduled decision with an owner. **If this ticket goes unclaimed
for a month, ticket 13 will never move** — that is the failure mode to watch for.

## Done when

Ticket 13's Done-when can be restated as a concrete, checkable condition, and the
Answer records the observed arrival rate that justified the number.
