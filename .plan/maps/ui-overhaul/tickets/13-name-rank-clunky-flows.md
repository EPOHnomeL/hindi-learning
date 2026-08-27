---
type: grilling
blocked_by: [08, 10]
---
# Name and rank the clunky flows from the evidence

> `/wayfinder .plan/maps/ui-overhaul/tickets/13-name-rank-clunky-flows.md`

## Question

The map names three ills, "looks amateur", clunky flows, weak mobile. This settles the
second: **which journeys are actually clunky, ranked, on evidence rather than
suspicion.** It is the ticket the whole PostHog strand exists to serve, and the reason
the Flow fixes fog was blocked.

Ticket 04 nominates three suspects. They are the first places to look, not the answer:
the authoring composer stuffed into a dashboard grid cell, pricing and payouts and
access control sharing one modal, and `/admin` role-branching on a single route.

How to work it:

- **Watch every replay.** Rage clicks, dead clicks, back-navigation, long hesitations,
  mis-taps on mobile especially.
- **Funnels find sessions, they do not compute rates.** Ten sales cannot support a
  percentage; one confused visitor swings a "30% drop-off".
- **Rank what you find**, with a stated reason for the order. A flat list of gripes
  does not feed per-surface work.
- **Label every finding observed or inferred.** A self-walkthrough on a real phone is
  admitted evidence, but an untagged guess recorded as an observation is how a
  redesign gets aimed at the wrong surface.

With ticket 08 done this is largely AFK: an agent queries events and recordings
through the PostHog MCP and brings findings back for judgement.

## Done when

Every session recorded in the **two weeks after ticket 10 goes live** has been watched,
and the flows are named and ranked with the evidence for each, each marked observed or
inferred, precisely enough that the map's Flow fixes fog graduates into per-flow
tickets. Proceed on whatever evidence exists at the end of that window; a thin trickle
of traffic does not stall the map. (This bar came from ticket 12, which was ruled out
as ceremony on 2026-08-27.)
