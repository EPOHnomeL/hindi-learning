# Backfill existing rows (migrate)

Status: done — shipped 715636e (backfill action), 63d46fc (verify), cc626a7 (strip inline html); merged via PRs #8/#9.

## What to build

A one-shot migration that moves every existing Lesson/Reference/translation body
out of the DB and into a **content blob**. Because `ctx.storage.store()` is
action-only, this is an **action** (like the existing `backfillQuizShuffle`
driver), paginated, secret-gated, idempotent.

- An action pages through each table (`lessons`, `references`, `translations`
  of `kind` lesson/reference), reads the inline `html`, stores it as a blob, and
  patches `htmlStorageId` via a mutation.
- Idempotent: rows that already have `htmlStorageId` are skipped, so re-running
  is a safe no-op.
- A `tsx` driver (`backfill-html-blobs[:prod]`) threads the cursor, mirroring
  `scripts/backfill-quiz-shuffle.ts`.
- **The prod run is performed by the operator, not the agent.** This ticket
  delivers the code + a runbook; running it against prod and verifying is a
  manual step that gates the narrow ticket.

## Acceptance criteria

- [ ] The action stores a blob for a row with inline `html` and patches `htmlStorageId`; a row that already has `htmlStorageId` is skipped.
- [ ] Re-running the backfill is a no-op (idempotent).
- [ ] A bad `PUBLISH_SECRET` is refused.
- [ ] A `tsx` driver runs it a page at a time against dev/prod, threading the cursor.
- [ ] A short runbook documents the prod run + how to verify before narrowing.

## Runbook (operator)

The agent builds + tests this; **the operator runs it against prod.**

1. **Dev first:** `pnpm run backfill-html-blobs` — migrates the dev deployment.
   Spot-check: open a course in dev; lessons/references still render (now served
   from `/content`). The console prints `<table> N migrated (M scanned)` per table.
2. **Snapshot prod** (Convex dashboard) before touching live data.
3. **Prod:** `pnpm run backfill-html-blobs:prod`. Idempotent — safe to re-run if
   interrupted (already-migrated rows are skipped).
4. **Verify prod before narrowing:** every published lesson/reference renders in
   the live app; the Convex dashboard shows Database I/O reads dropping on
   subsequent days. Only then start issue 05 (drop inline `html`).

Note: the backfill itself reads all inline HTML once — expect a transient
Database I/O bump the day it runs. It is the *last* time that HTML moves through
the database.

## Blocked by

- Publish writes blobs (mutations + teach CLI + translate)
