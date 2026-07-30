# architecture-deepening/03: Stop re-deriving paygate lock state on the client

**Status:** closed (landed on `main`)
**Labels:** —

## Why

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

## Scope

- `convex/content/reader.ts`'s `listLessons` returns a per-lesson `locked: boolean` computed from
  the same `lessonLocked` helper `getLesson` already uses (`convex/lib.ts:647-654`), instead of
  the caller re-deriving it from `previewKey`.
- `CourseShell.tsx` and `ArtifactView.tsx` read the server-provided `locked` flag instead of
  re-checking `role`/`previewKey` themselves.

## Out of scope

- Changing the paygate rule itself (`lessonLocked`) — this ticket only relocates where it's
  evaluated, not what it decides.
- `capture.myQuestions`'s separate `readableLang`-based path (edition-deepening ticket 03 already
  documented that as a deliberate, narrow exception — not this ticket's concern).

## Acceptance criteria

- [x] `listLessons` response includes `locked` per lesson.
- [x] `CourseShell.tsx` and `ArtifactView.tsx` contain no independent `role === "preview"` /
      `previewKey` lock-state re-derivation — they read the server field.
- [x] A change to the paygate rule (e.g. moving the Preview to a different lesson) is correct in
      the TOC and the artifact view from one server-side change, no client-side follow-up.

## Tests (TDD, `convexTest` seam)

1. `listLessons` on a `preview`-level caller returns `locked: true` for every lesson except the
   Preview key, `locked: false` for the Preview lesson itself.
2. `listLessons` on a `viewer`/`owner`/`entitled`/`enrolled` caller returns `locked: false` for
   every lesson.
3. Component-level: TOC and artifact view render the locked affordance driven by the server field
   (not a local re-derivation) — assert by checking the field is read, not recomputed.

## Notes

Independent of tickets 01/02/04/05.

## Comments
