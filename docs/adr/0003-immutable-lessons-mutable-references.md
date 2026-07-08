# Immutable Lessons, mutable References

A **Lesson** is an immutable, append-only artifact: refinement produces the *next* Lesson, never an edit to a published one, and a genuinely bad Lesson is **superseded** (marked superseded, replaced by a new one) rather than mutated — mirroring how the teach skill already treats learning-records. A **Reference** is the opposite: mutable, revised in place, current-version-wins — mirroring how the skill treats reference docs and the glossary ("lessons will rarely be revisited — reference documents will be").

## Consequences

- Responses and Questions point at specific prompts inside a specific Lesson; because Lessons never mutate, that feedback history never rots (the key reason to forbid in-place lesson edits).
- A Lesson's HTML can be aggressively cached, since a given Lesson id never changes.
- The two served artifacts diverge in the schema on mutability and on whether they capture anything (Lessons do, References don't).

## Amendment — owner manual prose edits (course-content-editing)

An **owner** may correct a published Lesson's **prose in place** (the hover-pencil editor, `convex/content.ts:editLesson`) **provided the quiz structure is unchanged** — the counts of `data-correct` / `data-answer` / `data-k` markers, checked with `quizStructureMatches`. A save that changes those counts is **rejected**, not applied.

This does not weaken the guarantee above. The reason to forbid in-place edits is that Responses and Questions anchor to prompts that must not move; the quiz-structure guard is exactly what protects that anchoring — a prose fix leaves every quiz's positional identity intact, so existing feedback still points at the same prompt. A genuinely **structural** change (adding, removing, or reordering quiz options/answers) still requires **supersede**, not mutation; superseding a Lesson from the UI is out of scope here (course-authoring issue 02).

Editing swaps the Lesson's content blob (`htmlStorageId`) for a new one and deletes the old, so "a given Lesson id never changes" now means the *row* id, not the blob id — the aggressive per-blob caching still holds, since a corrected body gets a fresh `storageId` → fresh URL.
