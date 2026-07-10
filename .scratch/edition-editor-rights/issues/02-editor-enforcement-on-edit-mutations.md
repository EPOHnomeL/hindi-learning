# 02 — Editor enforcement on edit mutations + server-driven canEdit

Status: ready-for-agent

Parent: [PRD](../PRD.md) · depends on [01](01-schema-and-backend-model.md)

## Goal

Let an Editor perform exactly the owner's hover-pencil edits on the one Edition
they hold, enforced server-side; everything else stays owner-only.

## Scope

- **`convex/content.ts` — switch the three content-edit paths from
  `getOwnedTopic` to `getEditableTopic` with the correct lang:**
  - `editLesson` + its `lessonEditTarget` / `applyLessonEdit` helpers → lang
    `SOURCE_LANG` ("en").
  - `editReference` → lang `SOURCE_LANG`.
  - `editTranslatedLesson` + `translatedLessonEditTarget` / apply helper → the
    explicit `lang` arg.
  - Every internal helper that independently re-checks ownership must use the
    same editable check, so an Editor isn't rejected by a second guard.
- **Do NOT change** `deleteLesson`, `renameTopic`, Mission edits, `shareTopic`,
  `setTopicPublic` / `setEditionPublic`, translate, complete, or Emblem
  mutations — they keep `getOwnedTopic`.
- **Server-computed `canEdit`.** The content query feeding the reader returns a
  per-Edition `canEdit` boolean for the served lang (owner, or editor of that
  lang) using the `getEditableTopic` logic. (Find the reader content query that
  currently drives `ArtifactView`; add `canEdit` to its return shape.)

## Acceptance (convex-test, extend `content.test.ts`)

- An Editor of the English Edition can `editLesson` and `editReference`; the read
  seam returns the new body afterward.
- An Editor of a translated Edition can `editTranslatedLesson`; the English
  source row is left unchanged.
- **Rejected:** a plain Viewer, an Editor of a *different* Edition/lang, a
  non-owner non-editor, and (via the public path) a Guest cannot call any of the
  three edit mutations.
- The quiz-structure guard still rejects a structural change made by an Editor.
- The content query returns `canEdit: true` for owner and for an editor of the
  served lang, `false` for a Viewer.

## Notes

Keep the guard swap mechanical and lang-correct — the whole security of the
feature is that an editor-Share for lang X never authorizes an edit to lang Y.
