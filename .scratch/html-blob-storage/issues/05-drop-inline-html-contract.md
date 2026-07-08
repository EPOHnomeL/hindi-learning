# Drop inline `html` (contract)

Status: ready-for-agent

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
