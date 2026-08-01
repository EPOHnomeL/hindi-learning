---
type: task
blocked_by: []
---

# Drop inline `html` (contract)

## Question

**Where it stands:** implemented (lessons + references) — translations deferred

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

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — accurate as written: lessons + references are blob-only (`htmlStorageId` only, schema.ts:78-91, 128-139), but translations still carry inline `html` in the schema (schema.ts:299-320), the publish path (`publishTranslation`, translate.ts:294-331), and the read fallback (`pickContentBody`, lib.ts:101-114). The final narrow step for translations remains open.

## Done when

`translations.html` moves to blob storage so the read path drops its dual shape, and the quiz-structure guard that a blob-backed source currently bypasses is restored.

<!-- Migrated 2026-07-30 from GitHub issue #69 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `html-blob-storage` map (2026-08-01)

<!-- was .plan/maps/course-translation/tickets/05-drop-inline-html-contract.md; that single-ticket map was consolidated into course-translation, since its remaining scope is the translations.html write path -->

- Destination: the inline-`html` column gone from the contract entirely, so the content read
  path has **one** shape instead of two. Lessons and references already moved; this closes
  the remaining `translations.html` write path.
- **Already landed:** lessons + references, the dominant tables (132 + 23 prod rows, largest
  bodies). The narrowing was deliberate, not incomplete.
- **What is left is `translations.html`:** `publishTranslation` still writes translated bodies
  inline, so `pickContentBody` and the client `useContentHtml` must still handle both shapes.
- **The real cost of the move so far, recorded honestly:** with source Lesson bodies in blobs,
  the markup is not readable inside a mutation, so `publishTranslation`'s **quiz-structure
  guard no longer runs** for a blob-backed source. Restoring it (validate in the driver, or
  make `publishTranslation` an action that fetches the blob) belongs with this migration —
  it is not a separate nice-to-have.
- **Schema-narrowing sequencing gotcha** (see `docs/agents/project-context.md`): Convex
  validates data on push, so dropping a field needs the data stripped of it first, as its own
  earlier merge. Plan two commits, not one.
- Skills: `convex:convex-expert`, `convex:convex-migration-helper` (widen-migrate-narrow),
  `/tdd`.
- **Out of scope:** any change to what the content route serves to a reader — this is storage
  shape only.
