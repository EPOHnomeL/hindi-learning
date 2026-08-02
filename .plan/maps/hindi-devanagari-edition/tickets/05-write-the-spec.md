---
type: task
blocked_by: [01, 02, 03, 04]
---
# Fold the decisions into `spec.md` for handoff

> `/wayfinder .plan/maps/hindi-devanagari-edition/tickets/05-write-the-spec.md`

## Question

This map is plan-only; its destination is a spec one session can build from. Write
`.plan/maps/hindi-devanagari-edition/spec.md` from the four resolved tickets — the model and
call shape (01), the prompt and chunk size proven on real content (02), the write path (03),
and the quality gate and rollback (04).

The reader of that spec is a single fresh session with no memory of this map. It should be able
to write the script, run it against prod, judge the result, and pull it if bad, without
reopening a decision.

## Done when

`spec.md` exists beside `map.md`, covering: the script's location and invocation, the exact
prompt, the model and how it's reached, chunking, the per-row write procedure, idempotency and
teardown, the mechanical checks, the judgement step, and the rollback. Every decision links the
ticket that made it rather than restating its reasoning. The map's Decisions-so-far indexes all
five tickets.
