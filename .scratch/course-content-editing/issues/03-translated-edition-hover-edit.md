# 03 — Translated-Edition hover-edit

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Topic, Lesson, Edition, owner). Same positional quiz guard as a Routine-published translation; respects [ADR 0003](../../../docs/adr/0003-immutable-lessons-mutable-references.md).

## Parent

[`.scratch/course-content-editing/PRD.md`](../PRD.md) — Owner hover-edit for course text. Directly serves the Afrikaans-Edition fixes motivating [course-authoring issue 02](../../course-authoring/issues/02-direct-course-editing.md).

## What to build

Let the owner edit a **translated Edition's** Lesson text in place. When the owner is viewing a translated Edition (readers already switch Editions), the pencil edits **that Edition's** Lesson body — correcting an untranslated term or pasting the correct published wording — without a full re-translate. The save patches the Edition's `translations` row, passes the **same positional quiz-structure guard** the source Lesson uses, and **leaves the English source untouched**. Live for readers of that Edition immediately.

## Acceptance criteria

- [ ] While the owner is viewing a translated Edition of a Lesson, the pencil edits that Edition's body (edit-in-context; no separate Edition picker).
- [ ] On save, the edited body is uploaded as a new content blob, an owner-guarded mutation swaps the `translations` row's `htmlStorageId` and deletes the previous blob (verified gone).
- [ ] The save is refused if it changes the `data-correct` / `data-answer` / `data-k` marker counts (same guard as the source Lesson), and accepted for a prose-only edit.
- [ ] The English source Lesson and other Editions are unchanged by the edit.
- [ ] The mutation rejects any non-owner caller (including a Viewer of the shared Edition).
- [ ] After save, a reader of that Edition sees the new body; readers of the source and other Editions do not.
- [ ] Tests at the mutation seam: owner edits a translated Lesson, it round-trips, old blob deleted, source row unchanged; guard rejects a structural edit; non-owner rejected.

## Blocked by

- Ticket 01 — Source Lesson hover-edit (shared editor surface + write path).
