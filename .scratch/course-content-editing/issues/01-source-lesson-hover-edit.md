# 01 — Source Lesson hover-edit, end-to-end

Status: done — shipped a41aa9a (write path), bbaa7c8 (editor); fix aaea5f3 (never swap body on unverifiable edit).

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Topic, Lesson, owner, Viewer, Guest, Edition). Respects — and **amends** — [ADR 0003](../../../docs/adr/0003-immutable-lessons-mutable-references.md) (immutable Lessons). Rides the content-blob write path from [`html-blob-storage`](../../html-blob-storage/PRD.md) (merged to main).

## Parent

[`.scratch/course-content-editing/PRD.md`](../PRD.md) — Owner hover-edit for course text. Thin first slice of [course-authoring issue 02](../../course-authoring/issues/02-direct-course-editing.md).

## What to build

The tracer bullet that proves the whole mechanism. An **owner** reading one of their **source (English) Lessons** sees a **pencil affordance on hover**. Clicking it opens an editor panel showing the Lesson body as a **visual, editable surface** (not raw HTML). The owner corrects the text and saves; the fix is **live for every reader on the next reactive tick** — no publish step, no re-run.

A save that would change the Lesson's **quiz structure** is **refused** with a plain message; a prose-only edit is accepted. The affordance renders only for the owner, and the edit is rejected server-side for any non-owner regardless of the UI.

This ticket builds the **shared editor surface** and the **owner-edit write path** that tickets 02 and 03 reuse. It also lands the **ADR 0003 amendment** recording the guarded-in-place-mutation carve-out.

## Acceptance criteria

- [ ] An owner hovering a source Lesson sees a pencil; a Viewer and a Guest never see it.
- [ ] The editor shows the Lesson body rendered with its authored CSS/layout (visual, not an HTML `<textarea>`), editable in place, with save and cancel.
- [ ] On save, the edited body is uploaded as a **new content blob** and an owner-guarded mutation swaps the Lesson's `htmlStorageId` and **deletes the previous blob** (verified gone).
- [ ] The mutation rejects a save whose edit changes the count of `data-correct` / `data-answer` / `data-k` markers (reusing `quizStructureMatches`), with a message the UI surfaces.
- [ ] The mutation accepts a prose-only edit that leaves those marker counts unchanged.
- [ ] The mutation rejects any caller who is not the Topic owner (Viewer, Guest, other user).
- [ ] After a successful save, the reader's next read of that Lesson returns the new body; presentation (iframe, quizzes, RTL) is unchanged.
- [ ] Cancel discards the edit with no write.
- [ ] [ADR 0003](../../../docs/adr/0003-immutable-lessons-mutable-references.md) is amended to record: owner manual **prose** edits may mutate a Lesson in place provided the quiz structure is unchanged; **structural** changes still require supersede (out of scope here).
- [ ] Tests at the mutation seam (convex-test, extending `content.test.ts`): owner-edits-source-Lesson round-trips and deletes the old blob; guard rejects a structural edit and accepts a prose edit; non-owner / Viewer / Guest are rejected. Reader-UI verified by eye.

## Blocked by

- None — can start immediately. (The content-blob write path it depends on is merged to main.)
