# 05 — Progress, read-only for Viewers

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Share**, **Viewer**). Spec: [`../PRD.md`](../PRD.md).

## Want

A Viewer sees the owner's **Progress** (completion marks) but cannot mark
Lessons complete or fire the next-lesson Routine — protecting the owner's
Frontier. The full Progress facet, top to bottom.

## Acceptance

- The owner's Progress (completion marks, "you're here / next") is visible to a
  Viewer via the owner-or-Viewer resolver (from **01**).
- A Viewer is refused server-side by the mark-complete / Progress write and by
  the next-lesson Routine fire — these stay owner-only, so a Viewer can never
  mutate the owner's Progress or trigger authoring.
- "Mark complete" and the next-lesson control are absent for a Viewer.
- A Viewer gets **no Progress of their own** (per PRD — out of scope).
- Tests (Convex seam): a Viewer can read Progress; mark-complete and Routine
  fire reject for a Viewer; the owner is unaffected.

## Depends on

- **01**.

## Notes

- Covers PRD stories 17 and 22. This is the load-bearing reason writes must be
  owner-only — a stray Viewer completion would advance the owner's Frontier.
