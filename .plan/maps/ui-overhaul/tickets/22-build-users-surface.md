---
type: task
blocked_by: [17, 19]
---
# Build the course Users surface

> `/wayfinder .plan/maps/ui-overhaul/tickets/22-build-users-surface.md`

## Question

Ticket 17 moved the access roster out of the per-Edition sharing panel and onto its own
course-scoped surface. Build it.

Today `AccessRoster` renders inside each Edition tab and calls
`shares.listEditionAccess({ topicSlug, lang })`, which returns invites only: accepted
`shares` plus unclaimed `pendingShares`, filtered to one language. An owner with three
languages therefore reads three partial lists and cannot answer how many people have
access to the course. Ticket 14 counted 68 shares across 14 Topics and 31 unclaimed
invites, 29 of them on `prophetic-school`, so the long case is real.

What the surface owes, from 17's Answer:

- The count of people with access to the **course**, not to one Edition.
- Who the course was shared with, language as a **row attribute** rather than the
  container that splits the list.
- Editor assignable **only** to someone already shared with. That constraint is the
  surface's reason to exist, not a nicety.
- Unclaimed invites visible as unclaimed, since a third of all invites never land.

A course-wide list needs a query that does not exist: `listEditionAccess` is
lang-filtered and takes a `lang` argument. Either add a course-scoped sibling or widen
it, and keep the `getOwnedTopic` owner gate exactly as it is either way.

Out of scope, with [topic-sharing](../../distribution/map.md) 06, 08 and 09: the edge
cases, the learner insights view, and what the roster grows into beyond the four things
above. Also out of scope here: paying buyers and public-link readers, who are not shares
and never were on this list.

Where the surface sits inside whatever container ticket 16 chose is 16's answer to obey,
not this ticket's to revisit.

Same constraints as 19. Owner checks stay server-side and `convex:convex-authz` runs
over the new query; all copy goes through an existing message namespace; tenant theming
stays expressible; `ConfirmDialog` from `ui.tsx` for the revoke confirm.

Use `/tdd` and `/ponytail`.

## Done when

The surface is built, `pnpm typecheck` is green, a test covers that Editor can only be
assigned to an existing share and that a non-owner cannot read the list, and the Answer
records a browser walk at 360px on `prophetic-school`, whose 37-row list is the surface's
stress case.
