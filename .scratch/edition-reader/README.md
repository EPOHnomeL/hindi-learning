# Deepening candidate: the Edition reader

**Status:** deferred — pick up *after* the next wayfinder sessions. Not yet
grilled or scoped into issues; this note just preserves the candidate.

Surfaced by an architecture review (2026-07-19). Strong recommendation, lowest
risk, in-process (pure computation — testable directly through its interface).

## The friction

The Edition *access decision* is already a deep module (`lib.editionAccessLevel`,
`resolveReaderEdition`). But the **translated-row read + English-source fallback**
never got its own interface, so every reader re-implements it:

- `content.ts` — private `trOne` + `editionMap`, plus title/body/question fallback
  inlined in `getLesson` / `listLessons` / `getReference` / `listReferences` /
  `courseHeader`.
- `public.ts` — `editionMap` is a **byte-for-byte copy** of `content.ts`'s (it's
  not exported), plus the same title/body/question fallback.
- `capture.ts` — inlines the `kind:"question"` map + fallback (`myQuestions`).
- `shares.ts` (`listSharedTopics`) and `certificates.ts` (`claimCertificate`) —
  hand-inline the `kind:"title", key:""` lookup instead of `lib.translatedTitle`.

Spread: the `by_topic_lang_kind_key` / `editionMap` / `kind:"title"` patterns
appear across ~11 files, ~38 sites.

## The move

Add an Edition reader to `lib.ts` — e.g. `loadEdition(ctx, topic, lang)`
returning a resolver with `.title()`, `.mission()`, `.lessonTitle(key)`,
`.body(row)`, `.questionText(q)`, `.reference(key)` — so the "translated row else
source" rule lives once. `content` / `public` / `capture` / `shares` /
`certificates` call it instead of re-implementing it.

Deletion test: passes — deleting the helper concentrates complexity (the rule
reappears across 11 files), so it earns its keep.

## Wins (codebase-design vocabulary)

- locality: fallback-rule bugs concentrate in one module.
- leverage: one interface, 5 call sites.
- deletes `public.editionMap` (a literal duplicate).
- interface stays small; implementation absorbs the 38 sites.

## Enabling seam

This is the enabling step for the bigger "one reader, two adapters" candidate
(collapse `content.ts`/`public.ts` + `ArtifactView`/`PublicReader`). Once the
projection is one deep module, that collapse is wiring two adapters onto a shared
core rather than a ~1,100-line rewrite.

## Next step when we pick this up

Run `/grilling` on the interface shape (what exactly `loadEdition` returns, how
it handles missing translations vs missing source, the `key` convention for
title/mission), then TDD it at the new interface and delete the old per-file
tests.
