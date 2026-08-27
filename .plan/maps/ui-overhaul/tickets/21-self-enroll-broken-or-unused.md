---
type: research
---
# Is free self-enroll broken, or just undiscovered

> `/wayfinder .plan/maps/ui-overhaul/tickets/21-self-enroll-broken-or-unused.md`

## Question

Ticket 14 found the `enrollments` table **empty** in production. ADR 0023's
self-enroll primitive has never granted anybody access, and the conditions for it
existed: `the-practice-of-prayer` and `india-prayer-journey-preparations` are both
published with no `listings` row, so both are free published Editions that any
signed-in caller should have been able to join.

Ticket 15 has to give this rail a verdict, and the verdict differs entirely depending
on which of these is true:

- **Broken.** The join path never worked, so zero rows says nothing about demand and
  retiring the rail would be retiring a bug.
- **Undiscovered.** It works, but nothing in the catalogue invites a learner to use
  it, so zero rows is a discovery problem, which is a flow fix and not a rail verdict.
- **Unwanted.** It works, it is discoverable, and nobody wants it.

Trace the path in the code (`convex/lib.ts` resolver, the `enroll` mutation, whatever
catalogue surface should offer it) and say which. A walked browser check on a free
published Edition beats reading, and CLAUDE.md wants the answer to say which kind of
evidence it had.

## Done when

The Answer names one of broken, undiscovered or unwanted, with the evidence it rests
on and whether that evidence was read or walked. If broken, it names the break
precisely enough for a fix ticket to be cut without re-investigating.
