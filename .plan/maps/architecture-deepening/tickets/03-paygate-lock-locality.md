---
type: task
blocked_by: []
---

# Stop re-deriving paygate lock state on the client

## Question

"Is this lesson locked" (the paid-Edition Preview paygate) is implemented three times instead of
once, server-side:

- `src/app/_components/CourseShell.tsx:107` re-checks `header?.role === "preview"`.
- `src/app/_components/CourseShell.tsx:214-215` re-derives per-lesson TOC lock state from
  `paywall.previewKey` (`locked={preview && l.key !== previewKey}`), duplicating the server's own
  `lessonLocked` rule (`convex/lib.ts:647-654`) — which today is only applied per-lesson-body-fetch
  (`getLesson`), not in `listLessons`.
- `src/app/_components/ArtifactView.tsx:416` independently re-checks `role === "preview"`.

Two independent client-side implementations of "is this item locked" that must be kept in sync by
hand whenever the paygate rule changes.

Scope: `convex/content/reader.ts`'s `listLessons` returns a per-lesson `locked: boolean` computed
from the same `lessonLocked` helper `getLesson` already uses (`convex/lib.ts:647-654`), instead of
the caller re-deriving it from `previewKey`; `CourseShell.tsx` and `ArtifactView.tsx` read the
server-provided `locked` flag instead of re-checking `role`/`previewKey`. Do not change the paygate
rule itself — only relocate where it's evaluated. `capture.myQuestions`'s separate
`readableLang`-based path stays a deliberate, documented exception (edition-deepening ticket 03).

Tests (TDD, `convexTest` seam): (1) `listLessons` on a `preview`-level caller returns
`locked: true` for every lesson except the Preview key, `false` for the Preview lesson itself;
(2) on a `viewer`/`owner`/`entitled`/`enrolled` caller, `locked: false` everywhere; (3)
component-level, the TOC and artifact view render the locked affordance driven by the server field,
not a local re-derivation.

## Done when

A change to the paygate rule (e.g. moving the Preview to a different lesson) is correct in the TOC
and the artifact view from one server-side change with no client-side follow-up: `listLessons`
ships a per-lesson `locked`, and `CourseShell.tsx` / `ArtifactView.tsx` contain no independent
`role === "preview"` / `previewKey` lock-state re-derivation.

## Answer

**Landed** on `main` (`2610434`). `lessonsToc`/`referencesToc` now take the caller's
`EditionAccess` and carry a per-item `locked` from the same `lessonLocked` the body reads use, so
`listLessons`/`listReferences`/`publicCourse` all ship the verdict. The References rule got the
same treatment (`referenceLocked`). The duplicate derivations were removed from `CourseShell.tsx`
**and** `PublicReader.tsx` — a third copy the spec hadn't listed. `ArtifactView.tsx` needed no
change: its `role === "preview"` gates Q&A and Progress, not lock state.
