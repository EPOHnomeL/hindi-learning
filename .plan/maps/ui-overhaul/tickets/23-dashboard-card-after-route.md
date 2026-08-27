---
type: grilling
blocked_by: [16]
---
# What the dashboard card carries once sharing is a route

> `/wayfinder .plan/maps/ui-overhaul/tickets/23-dashboard-card-after-route.md`

## Question

Ticket 16 decided course management moves from a dialog opened on the dashboard card to
its own route, `/courses/[slug]/manage`, and that route is a shell holding three peers at
two scopes (ticket 17): Sharing per Edition, Users and Course settings course-wide. The
owned card's action row today (`CourseCardActions.tsx`) opens one dialog from a dedicated
globe button beside `Open course`, and the kebab menu's `Editions & sharing` label. Both
now navigate to a shell with three destinations rather than open one layer over the
card's own page.

`Dashboard.tsx` is 959 lines carrying four near-duplicated card variants (owned, shared,
purchased, seeded), which ticket 06 already flagged as needing a destination. Decide:

- Does the globe button become a `Link` to the manage route (landing on Sharing, its
  current job), stay an icon button, or disappear now that the route is reachable from
  inside the course itself?
- Does the kebab still carry one `Editions & sharing` row, or does it need three rows now
  that the shell holds three peers, or does the shell's own top-level nav make a second
  set of kebab rows redundant?
- Whether this reshuffle is worth doing standalone or folds into ticket 06's card
  collapse, since both touch the same four-card file.

## Done when

The Answer states what the owned card's action row looks like once `onOpenEditions`
navigates instead of opening a dialog, and whether the kebab keeps its own entry to the
same destination.
