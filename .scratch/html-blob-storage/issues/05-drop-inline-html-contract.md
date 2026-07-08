# Drop inline `html` (contract)

Status: implemented (lessons + references) — translations deferred

## Scope note (during implementation)

Narrowed **lessons + references only** — the dominant, hottest tables (132 + 23
prod rows, largest bodies). `translations.html` is **kept**: `publishTranslation`
still writes translated bodies inline, and migrating that write-path to blobs is
a follow-up. So the read path keeps its dual shape (`contentUrl` | inline `html`)
for translations; `pickContentBody` and the client `useContentHtml` still handle
both.

**Behaviour change to note:** with source Lesson bodies in blobs, the source
markup isn't readable inside a mutation, so `publishTranslation`'s
**quiz-structure guard no longer runs** for a blob-backed source (it's bypassed
for the trusted, secret-guarded run). Restoring it (validate in the driver, or
make `publishTranslation` an action that fetches the source blob) belongs with
the deferred translation-write migration.


## What to build

The contract step of M1, run **only after the prod backfill is verified**: remove
the inline HTML entirely so rows are thin and the DB I/O reads collapse.

- Remove `html` from `lessons` and `references`, and `translations.html`, from
  the schema.
- Remove the inline-`html` fallback branch from the resolver helper and the read
  seams — `htmlStorageId` (→ content URL) is now the only path.
- Make `storageId` required on `publishLesson` / `upsertReference` /
  `publishTranslation`.
- Simplify the client to the content-URL path only (drop the inline-`html`
  branch and its loading fallback).

## Acceptance criteria

- [ ] No `html` field remains on `lessons` / `references` / `translations`.
- [ ] Reads only ever return a `contentUrl`; the fallback branch is gone.
- [ ] Publish mutations require `storageId`.
- [ ] Full test suite green; reader verified manually against migrated content.

## Blocked by

- Backfill existing rows (migrate) — **and** the prod backfill verified by the operator.
