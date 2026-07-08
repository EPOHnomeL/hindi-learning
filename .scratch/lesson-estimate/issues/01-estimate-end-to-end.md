# 01 — `~N lessons` estimate, end-to-end

Status: ready-for-agent

## Parent

[PRD: Estimated lesson count](../PRD.md)

## What to build

The complete path for a Topic's soft **estimate** to flow from a report call all
the way to a line in the reader — fed manually for now (Slice 02 teaches the
Routine to feed it).

- A Topic carries an optional estimated total Lesson count.
- The existing secret-guarded report step can set it: `reportGeneration` gains an
  optional estimate that patches the Topic when present and leaves it untouched
  when absent (so a later `nothing`/`failed` report never wipes a prior
  estimate). The `report` script gains an optional `--estimate <n>` flag.
- The existing `generationStatus` query returns the estimate, **clamped** to
  `max(estimate, publishedCount)` (reuse the `topicLessonCounts` helper for the
  published, non-superseded count), and returns **no** estimate while the Topic
  is `seeded` or `completed`.
- The reader shows `~{n} lessons` in the generation-status area (the region that
  hosts `NextLessonButton`), owner-only, on the Frontier of an active course.
  Absent whenever the query returns no estimate.

Owner-only falls out of the existing access model: `generationStatus` is the
owner-facing status source and the render sits in an already owner-gated,
Frontier-only region — a Viewer or Guest never sees it.

## Acceptance criteria

- [ ] `topics.estimatedLessons` (optional number) exists in the schema; a Topic that has never been estimated has no value.
- [ ] `reportGeneration` accepts an optional estimate: when present it patches `topics.estimatedLessons`; when absent the field is left untouched; a bad/absent secret is refused (existing pattern).
- [ ] The `report` script accepts `--estimate <n>` and threads it through; omitting the flag behaves exactly as today.
- [ ] `generationStatus` returns the estimate clamped to `max(estimate, publishedCount)`, so it is never visibly below the real Lesson count.
- [ ] `generationStatus` returns no estimate while the Topic is `seeded` and once it is `completed`.
- [ ] The reader renders `~{n} lessons` for the owner on the Frontier of an active course when an estimate exists, and renders nothing when the query returns no estimate; it is not shown to a Viewer.
- [ ] Convex-seam tests in `routine.test.ts` cover: write (set / untouched-on-absent / bad-secret), read + clamp, and `seeded`/`completed` gating.
- [ ] `pnpm typecheck` and `pnpm test` pass.

## Blocked by

None — can start immediately.
