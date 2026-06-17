# 09 — Migrate the existing Hindi Topic onto the new model

Status: ready-for-agent

Spec: [`../PRD.md`](../PRD.md). Decision:
[ADR 0009](../../../docs/adr/0009-content-source-of-truth-in-convex-routine-pulls-context.md).

## Want

Carry the live Hindi content + the learner's capture history onto the
multi-tenant model without resetting anything.

## Acceptance

- A `hindi` Topic exists owned by Jonathan, `status: "active"`, with the existing
  Mission text in `topics.mission`.
- `Handbook.pdf` is moved into Convex file storage as a Resource of the `hindi`
  Topic (raw); the 35 MB blob is **removed from `git`** once verified.
- Existing `lessons/` + `references/` remain published and readable under `hindi`.
- Existing `responses`/`progress`/`questions` are backfilled with the `hindi`
  `topicId` (the narrow step of **03**).
- After migration, the reader with one Topic behaves exactly as before.

## Depends on

- **02**, **03** (capture backfill), **04** (Resource for the PDF).

## Notes

- Do this **last**, behind the schema work; it's the cut-over. Keep a Convex prod
  snapshot before the `git` blob removal (the lesson-5 drift incident is the
  cautionary tale — see [docs/routine.md](../../../docs/routine.md) §6).
