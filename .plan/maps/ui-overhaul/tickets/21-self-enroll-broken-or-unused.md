---
type: research
---
# Is free self-enroll broken, or just undiscovered

> `/wayfinder .plan/maps/ui-overhaul/tickets/21-self-enroll-broken-or-unused.md`

## Question

Ticket 14 found `enrollments` **empty** in production. ADR 0023's self-enroll
primitive has never granted anybody access, and the conditions existed:
`the-practice-of-prayer` and `india-prayer-journey-preparations` are both published
with no `listings` row, so any signed-in caller should have been able to join.

Pick one:

- **Broken.** The join path never worked, so zero rows says nothing about demand.
- **Undiscovered.** It works, but nothing in the catalogue invites a learner to use
  it. That is a flow fix, not a rail verdict.
- **Unwanted.** It works, it is discoverable, nobody wants it.

Trace it in the code (`convex/lib.ts` resolver, the `enroll` mutation, whatever
catalogue surface should offer it). A walked browser check on a free published Edition
beats reading, and CLAUDE.md wants the Answer to say which it had.

## Done when

The Answer names one of the three, with its evidence and whether that evidence was read
or walked. If broken, it names the break precisely enough to cut a fix ticket without
re-investigating.
