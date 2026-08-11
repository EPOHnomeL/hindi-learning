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

**Resolved 2026-08-04 — and NOT as this line originally read.** The old text said
`translations.html` moves to blob storage; it does not, and that half was dropped
deliberately, not deferred. What actually closed the ticket was restoring the
quiz-structure guard via the `publishTranslationChecked` action (see the map's
"Two gaps closed after the map" note). `translations.html` **stays inline** and the
read path **keeps** its dual shape — `convex/schema.ts` records that as the settled
decision, same day.

Corrected 2026-08-11, after a session read this line and nearly migrated the table
to blobs on the strength of it, reversing a week-old decision. If the cost of the
fat rows is what brought you here: the fix that does *not* touch this decision is to
move `html` into its own table, keyed by the same `(topicId, lang, kind, key)` tuple,
so the row the reader collects is slim while the body stays inline where it lives.
Partly addressed already in `784eb70`, which stopped list queries reading kinds they
never use (95% of the Jul 8 – Aug 7 2026 Database I/O bill).

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

## Answer

**Resolved 2026-08-04 — lessons and references are blob-only; `translations.html` stays
inline, and the dual read shape is the accepted end state.**

What shipped: `lessons` and `references` carry `htmlStorageId` only — the dominant, hottest
tables (132 + 23 prod rows, the largest bodies). That was the bulk of the win.

What is **not** done, and is now being closed rather than built: this ticket's own Done-when
asked that `translations.html` move to blob storage "so the read path drops its dual shape".
It has not. Verified 2026-08-04 by reading the tree:

- [convex/schema.ts:438](../../../convex/schema.ts#L438) — `html: v.optional(v.string())` is
  still on `translations`, alongside `htmlStorageId`.
- `pickContentBody` ([convex/lib.ts:108](../../../convex/lib.ts#L108)) still resolves either
  shape, and the client `useContentHtml` still handles both.

**The decision is to keep it.** The dual shape costs one branch in one helper, and it is
exercised constantly rather than rotting in a corner — every new translation writes inline
`html`, so the "fallback" is in fact the live path for the whole `translations` table.
Migrating it would buy a narrower schema at the price of a widen-migrate-narrow across a
table that is still being written to daily, plus the two-commit push sequencing Convex forces
on a field drop.

**The one real cost — the dead quiz-structure guard — was fixed 2026-08-04.**

The problem, precisely: with source Lesson bodies in blobs, `readSource` returns only an
`htmlStorageId`, so the guard's own condition (`src.html !== undefined`) is never true for a
lesson and **the check never fired**. It was dead code, not a disabled feature.

It was narrower than first recorded, though. `translateTopic` — the LLM run, and by far the
highest-volume caller — already ran `quizStructureMatches` itself in the action, where it holds
the blob text ([convex/translate.ts](../../../convex/translate.ts)). The unguarded callers were
everything *else*: the teach CLI and `scripts/st-za-rewrite.ts`, which published 59 `st-ZA` rows
with no structural check at all.

The fix took the second of the two options sketched here — an action that fetches the blob —
without disturbing the mutation:

- **`publishTranslationChecked`** (action) re-reads the source blob via a new `sourceBlobId`
  internal query, runs `quizStructureMatches`, and delegates to the existing mutation. An
  unreadable blob refuses rather than passes, since a silent pass is how this broke the first time.
- Both script callers now publish through it.
- The bare mutation keeps its (unreachable-for-lessons) branch as a last line of defence, and a
  test pins that hole open on purpose so it cannot quietly widen.

This does **not** retroactively validate the 59 `st-ZA` rows already on prod, and it would not
have caught [ticket 09](09-unescaped-quote-breaks-quiz-feedback-markup.md)'s defect either —
that is a malformed attribute in the *English source*, upstream of any translation guard.
