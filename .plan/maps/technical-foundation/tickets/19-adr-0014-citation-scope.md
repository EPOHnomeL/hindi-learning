---
type: grilling
blocked_by: []
---
# ADR 0014 is cited far more narrowly than its own scope

## Question

`convex/routine.ts` cites
[ADR 0014](../../../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md) three
times (lines 32, 540 and 660, verified 2026-09-01) as the rationale for the shipped per-course
authoring Provider field. But the ADR's real scope is much larger: a BYOK line, an Agent-SDK
port, and per-customer metering. It is still `status: proposed (not yet built)`.

So the code cites a proposed ADR as the authority for one small piece of it, and a reader who
follows the citation lands on a document mostly describing things that do not exist.

`architecture-deepening/05` found this, deliberately left the ADR untouched, and recorded it as
**awaiting the user's sign-off**. It has been waiting since that map closed, which is why it is
now a ticket here.

**This needs a human decision, which is why it is a grilling and not a task.** Two options were
named:

1. **Narrow the citation** so `routine.ts` points at only the part of 0014 that shipped.
2. **Split the ADR** into the decision that shipped (per-course authoring Provider) and the
   ones that did not (BYOK, Agent-SDK port, metering).

Constraint from this repo's conventions: **never rewrite an ADR to correct it.** A stale ADR
gets a superseding ADR, and the original stands as the record of what was decided and when.
Option 2 therefore means a new ADR plus a status change on 0014, not an edit to its body. Note
also that [12](12-cost-instrumentation.md) explicitly defers full per-run accounting to 0014's
runtime, so whatever this decides should leave that pointer valid.

## Done when

The Answer picks 1 or 2, and either the citation is narrowed or the superseding ADR is written.
`docs/adr/` and `convex/routine.ts` agree afterwards.
