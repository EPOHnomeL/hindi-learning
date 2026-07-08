# Backfill existing rows (migrate)

Status: ready-for-agent

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

## Blocked by

- Publish writes blobs (mutations + teach CLI + translate)
