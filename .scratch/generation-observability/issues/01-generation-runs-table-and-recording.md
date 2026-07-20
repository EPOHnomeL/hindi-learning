# 01 — `generationRuns` table + record at terminal exits

**Status:** resolved (commit d625b3a)
**PRD:** [`../PRD.md`](../PRD.md) · Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Routine, Topic, Frontier, Generation Run)

## What to build

The durable, append-only **Generation Run** log, and the write that populates it
at every point a run ends. This is the foundation the other issues read.

### Schema — new `generationRuns` table (`convex/schema.ts`)

One immutable row per finished run. Insert-once (never patched/deleted), like
`lessons` / `learningRecords` / `certificates`.

```ts
generationRuns: defineTable({
  topicId: v.id("topics"),
  outcome: v.union(v.literal("published"), v.literal("nothing"), v.literal("failed")),
  startedAt: v.number(),
  endedAt: v.number(),
  error: v.optional(v.string()),
  // Set only on a `published` run — the Frontier Lesson this run advanced to.
  producedLessonKey: v.optional(v.string()),
  producedLessonTitle: v.optional(v.string()),
}).index("by_topic", ["topicId"]),
```

`_creationTime` is the insertion time; `endedAt` is the run's own end stamp (equal
to insertion in practice, but explicit so the field survives a future backfill /
provider change). `by_topic` supports a possible per-course view later; the global
history query (issue 02) reads the table's default `_creationTime` order.

### `recordRun` helper (`convex/routine.ts`)

A single internal helper both the report path and the failure paths call, so the
row shape is written in exactly one place:

```ts
async function recordRun(ctx: MutationCtx, args: {
  topicId: Id<"topics">;
  outcome: "published" | "nothing" | "failed";
  startedAt: number | undefined; // the lock's startedAt; fall back to now if absent
  error?: string;
  producedLessonKey?: string;
  producedLessonTitle?: string;
}): Promise<void>
```

Wire it into the three terminal exits (do **not** touch `tryAcquireGeneration`):

- **`reportGeneration`** — after the lock is settled, insert a run row with the
  reported `outcome`. On `published`, read the Topic's current Frontier
  (highest-seq non-superseded Lesson — reuse `frontierLesson`) and record its
  `key` + `title` as the produced Lesson. Use the lock row's `startedAt` (read
  before it's cleared) for `startedAt`.
- **`failGeneration`** — insert a `failed` row (the fire never landed) with the
  passed `error`.
- **`expireUnclaimedFinish`** — insert a `failed` row (the finish run never
  claimed) with the existing "finish run never claimed…" error string.

Guard: only record when there was a real run to end (e.g. skip if there's no lock
row / no Topic, matching each function's existing early-returns).

## Acceptance criteria

- [ ] `generationRuns` table added with the fields + `by_topic` index above.
- [ ] `recordRun` helper writes the row in one place; the three call sites use it.
- [ ] A `published` report persists a row: right `topicId`, `outcome: "published"`,
      `producedLessonKey`/`Title` = the current Frontier Lesson, `startedAt` = the
      lock's `startedAt`, `endedAt` set.
- [ ] A `nothing` report and a `failed` report each persist a row with that outcome
      (no produced Lesson; `failed` carries the error).
- [ ] `failGeneration` and `expireUnclaimedFinish` each persist a `failed` row with
      their error string.
- [ ] `tryAcquireGeneration` and the fire path are unchanged (no row written at start).
- [ ] Tests (TDD) cover each of the five write paths and assert the row contents.

## Notes

- Fire-and-pray re-fires call `reportGeneration` once per lesson, so a finish loop
  naturally produces one run row per authored Lesson — correct.
- Leave room for issue 03 (cost): token/model columns are **not** added here.
