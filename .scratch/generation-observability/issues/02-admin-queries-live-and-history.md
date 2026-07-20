# 02 — sys-admin queries: `generatingNow` + `runHistory`

**Status:** open · **Blocked by:** [01](01-generation-runs-table-and-recording.md)
**PRD:** [`../PRD.md`](../PRD.md)

## What to build

Two sys-admin-gated read queries that back the Generation tab (issue 04). Both
gate on `isCallerAdmin(ctx)` (unscoped = sys admin, per `convex/whitelist.ts`) and
throw `"forbidden"` for anyone else — the security boundary, not the UI.

Put them in `convex/routine.ts` (they belong to the Routine domain).

### `generatingNow` — live "what's busy"

Reads the existing `generation` **lock** (not `generationRuns`), so both the Claude
Routine and the OpenRouter action path appear for free.

- Collect `generation` rows with `status === "generating"`.
- For each, join the Topic (`title`, `slug`).
- Compute `stale = startedAt !== undefined && now - startedAt > STALE_MS` (reuse the
  existing 10-min constant) so the UI can flag a crashed/stuck run.
- Return `{ topicSlug, topicTitle, startedAt, stale }[]`, newest-first by `startedAt`.

### `runHistory` — recent Generation Runs

- `ctx.db.query("generationRuns").order("desc").take(100)` (default `_creationTime`
  order — newest first). No pagination (YAGNI at internal scale).
- Join each row's Topic for `title`/`slug` (a deleted Topic → fall back to a
  placeholder title, don't drop the row).
- Return `{ topicSlug, topicTitle, outcome, startedAt, endedAt, error,
  producedLessonKey, producedLessonTitle }[]`.

## Acceptance criteria

- [ ] `generatingNow` returns only `generating` locks, each with the Topic title and
      a correct `stale` flag (false when fresh, true past `STALE_MS`).
- [ ] `generatingNow` excludes `idle`/`failed`/`caughtUp` locks.
- [ ] `runHistory` returns rows newest-first, bounded to the take limit, each with the
      Topic title and all run fields.
- [ ] A run row whose Topic was deleted still returns (with a placeholder title).
- [ ] Both queries throw for a non-admin (and for an unauthenticated caller).
- [ ] Tests (TDD) cover: admin sees the right rows; non-admin is rejected; stale flag;
      newest-first ordering; the take bound.

## Notes

- Return validators (`returns:`) per the Convex guidelines; shapes above.
- Keep the join simple (`ctx.db.get(topicId)` per row) — the lists are small.
