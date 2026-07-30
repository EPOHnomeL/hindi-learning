---
type: grilling
blocked_by: []
---

# The Edition reader — `lib.loadEdition`

## Question

The "translated row else English source" projection has no interface, so every reader re-implements it, and
`public.editionMap` is a **byte-for-byte copy** of `content.editionMap`. Design and land one deep Edition reader in
`convex/lib.ts` so the rule lives once.

**Design-in-ticket first** (grill the interface shape, per the README's own next-step), then TDD, then delete the
per-file tests it replaces.

Interface questions to grill:

- What exactly does `loadEdition(ctx, topic, lang)` return? A resolver object with `.title()`, `.mission()`,
  `.lessonTitle(key)`, `.body(row)`, `.questionText(q)`, `.reference(key)` — or a different shape? One read of the
  `editionMap` up front, or lazy per-item?
- Missing-translation vs missing-source: the fallback ladder for each accessor (translated row → source row → empty).
  Confirm it matches today's behaviour exactly (no regression).
- The `key` convention for title/mission (`kind:"title"|"mission"`, `key:""`) — fold in the **already-existing**
  `lib.translatedTitle`, which `shares.ts` and `certificates.ts` currently bypass with hand-inline lookups.
- How it composes with `pickContentBody` (already in `lib.ts`) for lesson/reference bodies.

Then migrate the call sites: `content.ts` (`trOne` + `editionMap` + inline fallback in `getLesson`/`listLessons`/
`getReference`/`listReferences`/`courseHeader`), `public.ts` (delete its duplicate `editionMap`), `capture.ts`
(`myQuestions` inline `kind:"question"` map), `shares.ts` (`listSharedTopics`) and `certificates.ts`
(`certificateTitle`) — adopt `translatedTitle`/`loadEdition` instead of the inline `kind:"title", key:""` lookups.

**Design (grilled 2026-07-20 — decisions before TDD):**

Interface lives in `convex/lib.ts`. `decodeEntities` **moves** to `lib.ts` (re-exported from
`content.ts` for existing importers) to avoid a `lib ↔ content` import cycle.

- **Q1 — read strategy: lazy point-reads + one explicit whole-edition map.** Single-item
  queries keep their point-read profile; list queries do one collect. No read-profile regression
  on the hot `getLesson` path (stays one point-read; does NOT collect the whole edition).
- **Q2 — a resolver object** bound to `(topic, lang)`, sync factory (no I/O to bind):

  ```ts
  const ed = loadEdition(ctx, topic, lang);          // EditionReader
  await ed.title()                → string           // course title, point-read, decoded
  await ed.mission()             → string | null    // point-read, decoded, null if no mission
  await ed.lesson(sourceLesson)  → { title, body }   // point-read; title decoded, body = pickContentBody
  await ed.reference(sourceRef)  → { title, body }   // point-read
  const m = await ed.map()       → EditionSnapshot   // ONE collect, memoized
    m.title(topic)     → string      // decoded
    m.lessonTitle(src) → string      // decoded
    m.referenceTitle(src) → string   // decoded
    m.question(q)      → { text, reply }  // NOT decoded (see Q3)
  ```

  Point accessors serve single-item queries; `map()` serves list queries. Both delegate to the
  SAME internal fallback helpers, so the "translated row else source" rule lives once even though
  there are two access paths tuned to two read profiles.
- **Q3 — decode ownership: titles decoded in-accessor; questions left raw.** Makes the title
  surface consistent. **Intentional behaviour change:** `shares.listSharedTopics` currently does
  NOT decode its card title — after migration it will (a latent `&amp;` bug fixed). Question
  text/reply stay raw (learner-typed, not generated-HTML-derived), matching today.
- **translatedTitle fold:** `ed.title()` = `decodeEntities(translatedTitle(...))`; `translatedTitle`
  stays the point-read primitive (market.myPurchases/checkoutInfo keep it, raw). `shares` and
  `certificates` migrate off their inline `kind:"title",key:""` lookups onto `ed.title()`.
- **Source-language:** `lang === SOURCE_LANG` → every accessor returns the source (map empty, point
  reads skipped), matching `trOne`/`editionMap`/`translatedTitle` today.

## Done when

`loadEdition` is the single home of the "translated row else source" projection: it replaces
`content.trOne`/`content.editionMap` and the byte-for-byte `public.editionMap`, and all call sites
(content/public/capture/shares/certificates) read through it — verified by the deletion test (deleting the
helper makes the rule reappear across ~11 files / ~38 sites) with read profiles preserved and the suite green.

## Answer

Landed `lib.loadEdition` and migrated all call sites. Commits:
`be164c5` (reader core + content.ts) and `69f845f` (public/capture/shares/certificates).

**What shipped**
- `loadEdition(ctx, topic, lang): EditionReader` in `convex/lib.ts` — sync factory binding
  `(topic, lang)`. Point-read accessors `title()`/`mission()`/`lesson(src)`/`reference(src)`
  for single-item queries; memoised `map(): EditionSnapshot` (`title`/`lessonTitle`/
  `referenceTitle`/`question`) for list queries. Both delegate to one internal `itemTitle`
  helper + `translatedTitle` + `pickContentBody`, so the fallback ladder lives once.
- `decodeEntities` moved to `lib.ts` (re-exported from `content.ts`) — no `lib↔content` cycle.
- Deleted `content.trOne`, `content.editionMap`, and the byte-for-byte `public.editionMap`.
- Migrated: `content.courseHeader/listLessons/getLesson/listReferences/getReference`,
  `public.publicCourse/publicLesson/publicReference`, `capture.myQuestions`,
  `shares.listSharedTopics`, `certificates.liveCourseTitle` + issue path.

**Read profiles preserved** (Q1): single-item paths stay one point-read; list paths one collect.
`courseHeader` is two point-reads (title+mission), equal-or-better than the old one collect.

**Intentional behaviour change:** `shares.listSharedTopics` card titles are now decoded (latent
`&amp;` render bug fixed). Question text/reply stay raw. Everything else byte-identical (verified:
the old `courseHeader` also decoded the source mission, so `mission()` matches).

**Tests:** new `convex/edition-reader.test.ts` (8 cases pinning the ladder + decode + reply
suppression). Full suite 554 pass; typecheck clean; convex:convex-reviewer found no regressions.

**Note for the content/public collapse fog:** the reader core is deep now, so the fogged collapse
can build authed/Guest adapters over `loadEdition`. Still blocked on ticket 03 (selection fold)
before it graduates — needs both 01 and 03 closed.
