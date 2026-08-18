---
type: task
blocked_by: [01, 02, 03, 04, 06]
---
# Fold the decisions into `spec.md` for handoff

> `/wayfinder .plan/maps/hindi-devanagari-edition/tickets/05-write-the-spec.md`

## Question

This map is plan-only; its destination is a spec one session can build from. Write
`.plan/maps/hindi-devanagari-edition/spec.md` from the resolved tickets — the model and
call shape (01), the prompt and chunk size proven on real content (02), the write path (03),
the quality gate and rollback (04), and what happens to the source's untranslated English (06).

The reader of that spec is a single fresh session with no memory of this map. It should be able
to write the script, run it against prod, judge the result, and pull it if bad, without
reopening a decision.

## Done when

`spec.md` exists beside `map.md`, covering: the script's location and invocation, the exact
prompt, the model and how it's reached, chunking, the per-row write procedure, idempotency and
teardown, the mechanical checks, the judgement step, and the rollback. Every decision links the
ticket that made it rather than restating its reasoning. The map's Decisions-so-far indexes
every resolved ticket.

## Ruled out

**Ruled out of scope 2026-08-04. Not resolved — closed as a scope boundary.**

<!-- Heading corrected 2026-08-18: this section read `## Ruled out of scope (2026-08-04)`, and
     the reader matches the exact trimmed string `## Ruled out`, so the ticket had been reading
     as OPEN since 2026-08-04 — and this map as unfinished — despite the commit that closed it.
     The date moved into the prose below, where it does not break the match. -->

This ticket exists to hand a spec to "a single fresh
session with no memory of this map" that would "write the script, run it against prod, judge the
result, and pull it if bad". **That session no longer exists**: the user chose to finish in-session
instead, so the script was written and run, the Edition is live and `ready`, and the judgement step
is the owner's own read. A spec whose only reader was a build session that already happened would
be documentation of the past written in the future tense.

What the spec was for is preserved where it belongs, per "the map is an index, not a store":

- the script that actually published, at [assets/03-publish.ts](../assets/03-publish.ts), with its
  ordering constraints and the two owner/redaction traps written into its header comment;
- the check harness, at [assets/03-check-harness-relaxed.ts](../assets/03-check-harness-relaxed.ts);
- the per-row write procedure, idempotency and teardown in [03](03-the-write-path.md); the gate and
  rollback in [04](04-quality-gate-and-rollback.md); the prompt and chunk size in
  [02](02-does-naturalizing-conversion-hold.md).

This is a scope boundary, not a step on the route, so it stays out of Decisions-so-far. Note it did
**not** satisfy a blocking edge: nothing was blocked on 05 — it was the leaf.
