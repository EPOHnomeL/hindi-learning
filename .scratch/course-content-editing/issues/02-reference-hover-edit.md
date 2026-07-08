# 02 — Reference hover-edit

Status: done — shipped 2b80c95 (write path), 54ca447 (editor).

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Topic, Reference, owner). References are **mutable** per [ADR 0003](../../../docs/adr/0003-immutable-lessons-mutable-references.md) — no quiz guard.

## Parent

[`.scratch/course-content-editing/PRD.md`](../PRD.md) — Owner hover-edit for course text.

## What to build

Extend the hover-pencil + visual editor from ticket 01 to **References**. An owner reading a Reference gets the same affordance and the same editor. Because References are mutable by design, a save takes the write path **without** the quiz-structure guard. The fix is live for readers immediately.

## Acceptance criteria

- [ ] An owner hovering a Reference sees the pencil and gets the same visual editor as for Lessons; a Viewer and a Guest never see it.
- [ ] On save, the edited body is uploaded as a new content blob, an owner-guarded mutation swaps the Reference's `htmlStorageId` and deletes the previous blob (verified gone).
- [ ] The Reference save applies **no** quiz-structure guard — any prose edit is accepted.
- [ ] The mutation rejects any non-owner caller.
- [ ] After save, the reader's next read of the Reference returns the new body; presentation unchanged.
- [ ] Tests at the mutation seam: owner edits a Reference and it round-trips with the old blob deleted; a save with changed quiz-like markers is still accepted (no guard); non-owner rejected.

## Blocked by

- Ticket 01 — Source Lesson hover-edit (shared editor surface + write path).
