# Authoring efficiency

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

The remaining effort-reduction items on a single `teacher-next-lesson` run — lean
`materialiseTopic` digest, source-cache reuse, curriculum outline — decided and landed, with
the token and wall-clock saving **measured**, not asserted.

## Notes

- **Priority: high.** Every Routine run pays this tax and it compounds as Topics and lessons
  grow; it directly bounds Claude spend.
- The AUTHORING contract, `CAPTURE.json`, and deterministic setup already shipped
  (`df62360`, `a6c8c75`) — this map is the tail, not the whole effort.
- Constraint: cut effort **without lowering grounding or quality**. A cheaper run that
  teaches worse is a regression, not a win.
- Relates to ADR 0009 (Convex is source of truth) and ADR 0010 (swappable compute).
- Measurement overlaps
  [internal-course-studio/03](../internal-course-studio/tickets/03-cost-instrumentation.md) —
  that ticket builds the per-run token recording this one wants to measure against. Do it
  first if the numbers aren't available.
- Skills: `/ponytail` (the point is *less* work per run), `convex:convex-expert`.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

## Out of scope

- Changing the teaching loop's shape (ADR 0001) or the buffer-of-one gate — that's
  [scheduled-authoring/01](../scheduled-authoring/tickets/01-off-peak-course-generation.md).
