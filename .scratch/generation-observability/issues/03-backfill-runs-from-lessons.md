# 03 — one-shot backfill: `generationRuns` from existing Lessons

**Status:** open · **Blocked by:** [01](01-generation-runs-table-and-recording.md)
**PRD:** [`../PRD.md`](../PRD.md)

## What to build

A one-shot internal mutation that seeds the run log from Lessons that already
exist, so History (issue 02/04) isn't empty on launch. Run once per deployment via
`npx convex run` (mirrors `whitelist.migrateFromEnv` / the other backfills).

### The mutation

Add to a backfill module (match the existing `convex/backfill.ts` /
`convex/tenantBackfill.ts` convention):

```ts
export const backfillGenerationRuns = internalMutation({
  args: {},
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx) => { … },
});
```

For **every** Lesson in `lessons` (including superseded ones — each was a real
authoring event; excluding them would hide past rewrites from history):

- Insert a `generationRuns` row: `outcome: "published"`, `topicId = lesson.topicId`,
  `startedAt = endedAt = lesson._creationTime`, `producedLessonKey = lesson.key`,
  `producedLessonTitle = lesson.title`. No `error`.

**Idempotent:** re-running must not double-insert. Simplest guard — if
`generationRuns` already has any row, no-op and return `{ inserted: 0 }` (the
backfill only ever runs on a fresh log; once real runs exist it must not touch
them). Document that assumption in a comment.

## Acceptance criteria

- [ ] Inserts exactly one `published` run per existing Lesson (superseded included),
      with `endedAt = _creationTime` and the Lesson's key/title.
- [ ] Runs across all Topics, not just one.
- [ ] Idempotent: a second run inserts nothing (returns `{ inserted: 0 }`).
- [ ] Tests (TDD): seed Lessons across two Topics (one superseded) → one row each with
      the right fields; a re-run adds nothing.

## Notes

- Backfilled rows are intentionally synthetic (no real duration/outcome variety) —
  the PRD accepts this to populate day-one history; going-forward rows are real.
