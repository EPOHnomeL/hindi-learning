# 04 — Questions, read-only for Viewers

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Share**, **Viewer**). Spec: [`../PRD.md`](../PRD.md).

## Want

A Viewer sees the owner's **Questions** and Claude Code's **Replies** inline on
each Lesson, but cannot ask their own. The full Q&A facet, top to bottom.

## Acceptance

- The owner's Questions + Replies are visible to a Viewer via the
  owner-or-Viewer resolver (from **01**), rendered read-only inline as today.
- A Viewer is refused server-side by `askQuestion` — it stays owner-only.
- The ask form is absent for a Viewer; the existing Question/Reply thread stays
  visible.
- Tests (Convex seam): a Viewer can read Questions/Replies; `askQuestion`
  rejects for a Viewer; the owner is unaffected.

## Depends on

- **01**.

## Notes

- Covers PRD stories 16 and 21. The decision to show the owner's thread (rather
  than hide it) is settled in the PRD — "disable asking" means the form goes,
  the content stays.
