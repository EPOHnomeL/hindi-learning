---
type: grilling
blocked_by: [08, 12]
---
# Name and rank the clunky flows from the evidence

> `/wayfinder .plan/maps/ui-overhaul/tickets/13-name-rank-clunky-flows.md`

## Question

The ticket the whole PostHog strand exists to serve, and the reason this map's
**Flow fixes** fog was blocked. The map's problem statement names three ills —
"looks amateur", clunky flows, weak mobile — and this one settles the second:
**which journeys are actually clunky, ranked, on evidence rather than suspicion.**

Ticket 04's surface inventory already nominates suspects, and they are the first
places to look, not the answer:

- the authoring composer stuffed into a dashboard grid cell,
- pricing, payouts and access control sharing one modal,
- `/admin` role-branching on a single route.

Work it against the bar ticket 12 set:

- Watch the replays. At this volume every session can be watched individually — look
  for rage clicks, dead clicks, back-navigation, long hesitations, and mis-taps on
  mobile especially, since a weak phone experience is one of the map's three stated
  ills.
- Use funnels to *find* the interesting sessions, not to compute rates. Ten sales
  cannot support a percentage.
- Rank what you find. The output feeds per-surface work, so a flat list of gripes is
  not enough — it needs an order, and the order needs a stated reason.
- Say which findings are **observed** and which are **inferred**. Ticket 12 may have
  admitted a self-walkthrough alongside real sessions; if so, keep the two labelled.
  A guess recorded as an observation is how a redesign gets aimed at the wrong
  surface.

With ticket 08 done this is largely **AFK**: an agent can query the events and
recordings through the PostHog MCP directly and bring findings back for judgement.

## Done when

The clunky flows are named and ranked with the evidence for each, precisely enough
that this map's **Flow fixes** fog can graduate into per-flow tickets — and each
finding is marked observed or inferred.
