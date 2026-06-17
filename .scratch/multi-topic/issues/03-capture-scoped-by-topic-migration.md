# 03 — Capture scoped by Topic (migration)

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md). Spec: [`../PRD.md`](../PRD.md).
Decision: [ADR 0009](../../../docs/adr/0009-content-source-of-truth-in-convex-routine-pulls-context.md).

## Want

Stop `responses`/`progress`/`questions` from colliding across Topics (every
Topic's Lessons start at `0001-`) and scope the teacher's reads by owner + Topic.

## Acceptance

- `responses`, `progress`, `questions` gain `topicId`; indexes lead with
  `topicId` (e.g. `by_topic_user_lesson`, `by_topic_lesson`, `by_topic_status`).
- Capture mutations ([capture.ts](../../../convex/capture.ts)) record `topicId`;
  reader queries (`myProgress`/`myQuestions`) and the lesson capture path pass it.
- Teacher reads are Topic-scoped: `reviewState` no longer reads across **all**
  users; `routine.isCompleted` / the gate check completion for the **right**
  owner + Topic, not "any completed row" ([routine.ts](../../../convex/routine.ts)).
- Existing rows are migrated, not reset: **widen → backfill to the `hindi`
  Topic → narrow** using `@convex-dev/migrations` (see `convex-migration-helper`).

## Depends on

- **02** (Topic scoping / `ownerId`).
- Coordinate the backfill with **09** (the `hindi` Topic must exist / be owned).

## Notes

- This is the single most important correctness fix for multi-tenant — without
  it, one user completing their `0001-` satisfies another user's gate.
