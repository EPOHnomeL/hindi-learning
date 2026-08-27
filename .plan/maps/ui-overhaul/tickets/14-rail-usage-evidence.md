---
type: research
---
# Which share and sell rails has anyone actually used

> `/wayfinder .plan/maps/ui-overhaul/tickets/14-rail-usage-evidence.md`

## Question

The Editions and sharing dialog offers seven ways to hand a course to someone.
Publish to the catalogue, an anonymous public link, invite by email, set a price,
mint a batch of single-use vouchers, mint one shared organisation code, and the
older access-code rail. Before ticket 15 argues about which survive, count what
production has actually seen.

Per rail, from the live Convex deployment: how many rows exist, how many distinct
Topics use it, how many belong to a real tenant rather than a test course, and the
date of the most recent one. Lifetime sales are around ten, so these are countable
by hand, not sampled.

Read `convex/schema.ts` for the tables behind each rail, then use the Convex MCP
(`data`, `runOneoffQuery`) against the deployment. Do not write anything.

## Done when

The Answer carries one line per rail with its row count, distinct-Topic count and
last-used date, and names the rails with zero real usage. Any rail whose count
cannot be read is listed as unknown with the reason, not guessed.
