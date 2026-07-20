# PRD: Admin generation observability

Status: open — grilled & scoped 2026-07-20; not yet built.

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) (**Routine**, **Topic**,
> **Frontier**, **Lesson**). Respects [ADR 0008](../../docs/adr/0008-next-lesson-routine-gate-in-convex.md)
> (the gate + lock in Convex) and [ADR 0009](../../docs/adr/0009-content-source-of-truth-in-convex-routine-pulls-context.md)
> (Convex is the source of truth; the Routine reports back). Builds the durable
> run record that [internal-course-studio/03](../internal-course-studio/issues/03-cost-instrumentation-tokens-per-routine-run.md)
> (cost instrumentation) will later hang token usage on — but does **not** pull that work forward.

## Problem statement

> As an admin I want to be able to see what is being generated via my routine and
> the history of what was generated when and what is busy generating.

Today the operator is blind to the Routine. The only backend trace of authoring
is the `generation` table — a **single-flight lock, one row per Topic, overwritten
every run**. It answers "is this one Topic generating right now?" for the reader
button, but:

- It keeps **no history** — the moment a run reports, the prior run's record is gone.
- Runs that produce **nothing** (caught up) or **fail** leave no durable trace at all;
  only a successful Lesson (via its `_creationTime`) is even indirectly visible.
- There is **no admin surface** for generation activity — `/admin` has Allowlist,
  Sellers/Payouts, and Tenants, nothing about the Routine.

So the operator cannot answer "what generated last night", "why did nothing
generate", or "what's stuck generating right now".

## Solution

A **sys-admin-only** generation view at `/admin`, backed by a new append-only
**Generation Run** log:

- A new immutable `generationRuns` table records **one row per finished run**,
  written at every terminal exit of the run lifecycle (report / fire-failed /
  finish-expired). Fields: Topic, outcome (`published` | `nothing` | `failed`),
  `startedAt`/`endedAt`, `error`, and — for a `published` run — the **produced
  Lesson** (key + title). No trigger/provider/token fields (deferred; the token
  seam is issue 03's).
- The existing `generation` lock is **left untouched** and keeps driving the live
  "what's busy now" view — the hot acquire/gate path is not modified.
- A **one-shot backfill** seeds `generationRuns` with a synthetic `published` row
  per existing Lesson (all Lessons, including superseded ones), so history is
  populated on launch rather than empty.
- Two sys-admin-gated queries: `generatingNow` (live locks in `generating`, joined
  to Topic title, with a stale flag past the 10-min window) and `runHistory`
  (recent `generationRuns`, newest first, joined to Topic title).
- A new **"Generation" tab** in the sys-admin dashboard: a *Generating now* section
  over a reverse-chronological *History* list. Both are live Convex queries.

## Domain vocabulary (new)

**Generation Run**: one unattended invocation of the **Routine** against one
**Topic**, from fire to terminal outcome. Its durable record is a `generationRuns`
row; its outcome is `published` (a new Lesson advanced the Frontier), `nothing`
(the Topic was caught up / complete), or `failed` (the run errored, or never
landed/claimed). Distinct from the `generation` **lock**, which is the *live*
single-flight state, not the history.

## User stories

1. As the operator, I want to see which Topics are **generating right now**, with
   how long each has been running, so I know what the Routine is busy with.
2. As the operator, I want a **history of Generation Runs** — which course, what
   outcome, which Lesson it produced, and when — newest first, so I can see what
   was generated and when.
3. As the operator, I want **failed and produced-nothing runs** in that history,
   so I can tell why a course isn't advancing (not just see successes).
4. As the operator, I want a run that's been "generating" past the stale window
   flagged, so I can tell a stuck/crashed run from a genuinely in-flight one.
5. As the operator, I want day-one history populated from the Lessons that already
   exist, so the view isn't empty until the next runs fire.

## Implementation decisions

- **Sys-admin only.** All queries gate on `isCallerAdmin(ctx)` (unscoped = sys
  admin). No tenant-admin or owner surface (there is one global Routine on the
  operator's key). UI is a third tab in the existing sys-admin dashboard shell.
- **Append-only, insert-once run log**, mirroring the repo's immutable-history
  convention (Lessons / learningRecords / Certificates). Never patched, never
  deleted; unbounded (row count is trivial for a handful of internal courses — no
  pruning, YAGNI).
- **Write at terminal exits via one shared helper** (`recordRun`), called from
  `reportGeneration` (published/nothing/failed), `failGeneration` (fire never
  landed → failed), and `expireUnclaimedFinish` (finish run never claimed →
  failed). The gate/lock acquire path is **not** touched.
- **Produced Lesson** on a `published` run is read from the Topic's current
  Frontier (highest-seq non-superseded Lesson) at report time — that is the Lesson
  the run just advanced to.
- **Live view = existing lock.** `generatingNow` reads `generation` rows with
  `status === "generating"`, so both the Claude Routine and the OpenRouter action
  path (which share the lock) appear with no extra work. Stale = `startedAt` older
  than the lock's 10-min `STALE_MS`.
- **History query is bounded** (`.order("desc").take(N)`, N≈100) — no pagination
  (YAGNI for the internal scale). If it ever matters, add a cursor later.
- **Backfill** is a one-shot internal mutation (run via `npx convex run`),
  inserting a synthetic `published` row per Lesson with
  `startedAt = endedAt = lesson._creationTime` and the Lesson's key/title. Idempotent
  guard so a re-run doesn't double-insert.

## Out of scope

- **Token / cost recording** — deferred to internal-course-studio/03. This PRD only
  lays the run-log seam it will extend.
- **Trigger source and provider** on the run row — not recorded (kept lean per the grill).
- **Tenant-admin / owner-facing** generation views — sys admin only.
- **Pagination / filtering / search** over history — bounded recent list only.
- **Any change to the gate, lock, or fire path behaviour** — this is observation only.
- **Real-time push/notifications** — the live queries update via Convex reactivity
  when the admin has the tab open; no push.

## Testing decisions

Assert behaviour at the Convex seams, not UI detail:

- **Recording**: a `published` run persists a `generationRuns` row tied to the right
  Topic with the produced Lesson's key/title; a `nothing` run and a `failed` run each
  persist a row with the right outcome; `failGeneration` and `expireUnclaimedFinish`
  each persist a `failed` row. Prior art: existing `reportGeneration` / finish tests.
- **Queries**: `generatingNow` returns only `generating` locks with the Topic title
  and the stale flag set past `STALE_MS`; `runHistory` returns rows newest-first,
  bounded, with Topic titles; both reject a non-admin.
- **Backfill**: seeds one `published` row per existing Lesson (incl. superseded),
  with `endedAt = _creationTime`; re-running is idempotent (no duplicates).
- **UI** is verified by eye; not unit-tested.

## Issues

1. `01` — `generationRuns` schema + `recordRun` helper wired into the three terminal exits.
2. `02` — sys-admin `generatingNow` + `runHistory` queries.
3. `03` — one-shot backfill from existing Lessons.
4. `04` — the `/admin` "Generation" tab UI.
