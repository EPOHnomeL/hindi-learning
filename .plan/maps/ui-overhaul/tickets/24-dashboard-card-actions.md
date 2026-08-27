---
type: grilling
blocked_by: [16]
---
# What stays on the dashboard course card

> `/wayfinder .plan/maps/ui-overhaul/tickets/24-dashboard-card-actions.md`

## Question

Ticket 16 made management a route at `/courses/[slug]/manage` with four tabs, so the
owned course card on the dashboard no longer needs to carry management itself. Today
`CourseCardActions.tsx` gives the card a globe button and a kebab row, and
`Dashboard.tsx` is 959 lines with four duplicated cards.

Which per-course actions does the card keep, which become one "Manage" entry into the
route (and into which tab it deep-links), and which disappear?

## Done when

The Answer lists the card's final action set, names where each removed action went,
and states whether the four duplicated cards collapse into one component or that is
left to ticket 06.
