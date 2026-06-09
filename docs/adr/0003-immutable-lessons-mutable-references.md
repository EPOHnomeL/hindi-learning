# Immutable Lessons, mutable References

A **Lesson** is an immutable, append-only artifact: refinement produces the *next* Lesson, never an edit to a published one, and a genuinely bad Lesson is **superseded** (marked superseded, replaced by a new one) rather than mutated — mirroring how the teach skill already treats learning-records. A **Reference** is the opposite: mutable, revised in place, current-version-wins — mirroring how the skill treats reference docs and the glossary ("lessons will rarely be revisited — reference documents will be").

## Consequences

- Responses and Questions point at specific prompts inside a specific Lesson; because Lessons never mutate, that feedback history never rots (the key reason to forbid in-place lesson edits).
- A Lesson's HTML can be aggressively cached, since a given Lesson id never changes.
- The two served artifacts diverge in the schema on mutability and on whether they capture anything (Lessons do, References don't).
