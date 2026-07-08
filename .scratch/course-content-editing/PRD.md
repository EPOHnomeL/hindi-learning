# PRD: Owner hover-edit for course text

Status: ready-for-agent

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — **Topic**, **Lesson**,
> **Reference**, **Edition** (a Topic × language), **owner** vs **Viewer**,
> **Guest**. Respects [ADR 0003](../../docs/adr/0003-immutable-lessons-mutable-references.md)
> (immutable Lessons / mutable References) — **amended** by this feature (see
> Implementation Decisions). Builds on the in-flight **content blob** contract
> ([`.scratch/html-blob-storage/PRD.md`](../html-blob-storage/PRD.md)); this is the
> hands-on, thin first slice of [course-authoring issue 02](../course-authoring/issues/02-direct-course-editing.md).

## Problem Statement

An owner reads their authored course and spots a text defect — a typo, an awkward
sentence, an untranslated term in an Edition, a Bible verse back-translated
instead of quoted from the published translation. Today the only remedy is to
re-run the Routine (or a full re-translate of the whole Edition). There is **no
way to fix the words by hand**. The owner wants to correct the text in place,
where they're reading it, without instructing the AI and without regenerating
anything.

## Solution

Give the **owner** a **hover pencil** on each Lesson and Reference they're
reading. Clicking it opens an **editor panel** showing the item's body as a
**visual, editable surface** (not raw HTML) — the owner edits the words as they
appear, and saves. The fix goes **live immediately** to every reader (Convex
reactivity); there is no draft gate and no version bump in this slice.

- Works on the **source (English) edition and translated Editions** — the pencil
  edits whichever Edition is currently on screen (edit-in-context; no Edition
  picker to build).
- **Lessons stay immutable in structure** — a save mutates the *text* in place
  but is **rejected if it changes a quiz's structure** (the count of
  `data-correct` / `data-answer` / `data-k` markers), reusing the existing
  `quizStructureMatches` guard. Prose edits are allowed; structural edits are
  blocked with a plain message.
- **References** take the simpler mutable path — no guard (ADR 0003 already
  permits in-place Reference edits).
- **Owner-only**, end to end: the pencil renders only for the owner, and every
  edit mutation is owner-guarded server-side. Viewers and Guests never see the
  affordance and cannot call the mutation.

## User Stories

### Owner — editing source Lessons
1. As an owner reading one of my Lessons, I want a pencil affordance to appear when I hover it, so that editing is discoverable exactly where I noticed the problem.
2. As an owner, I want the pencil to open an editor showing the Lesson's text as it renders (not HTML source), so that I can fix words without understanding markup.
3. As an owner, I want to correct a typo or reword a sentence and save, so that the corrected text is what every reader sees.
4. As an owner, I want my save to appear for readers immediately, so that I don't have to publish or re-run anything.
5. As an owner, I want a save that would change a quiz's structure (add/remove/reorder options or answers) to be refused with a clear message, so that I can't silently break a Lesson's quiz scoring.
6. As an owner, I want a prose edit that leaves the quiz markers intact to be accepted, so that fixing the words around a quiz still works.
7. As an owner, I want to cancel an edit without saving, so that I can back out of a change I didn't mean to make.

### Owner — editing References
8. As an owner reading a Reference, I want the same hover pencil and editor, so that fixing a cheat-sheet feels identical to fixing a Lesson.
9. As an owner, I want a Reference edit to save without a quiz-structure check, so that the simpler mutable path isn't burdened by a guard it doesn't need.

### Owner — editing translated Editions
10. As an owner viewing a translated Edition of a Lesson, I want the pencil to edit *that Edition's* text, so that I can correct an untranslated term or a mistranslated passage in place.
11. As an owner, I want to paste the correct published wording (e.g. an Afrikaans Bible verse) into a translated Lesson, so that an Edition quotes the right source without a full re-translate.
12. As an owner, I want an edit to a translated Lesson to pass the same positional quiz-structure guard, so that an Edition's quiz can't be broken by a manual edit any more than the source can.
13. As an owner, I want my edit to a translated Edition to leave the English source untouched, so that Editions are corrected independently.

### Authorization
14. As a Viewer of a shared course, I want to never see the pencil and to be unable to edit, so that a read-only Share stays read-only.
15. As a Guest on a public link, I want no editing affordance at all, so that anonymous readers can only read.
16. As an owner, I want the edit mutation to reject any caller who is not the Topic's owner, so that authorization does not depend on the UI hiding a button.

### Integrity
17. As an owner, I want an edited body to render identically to an authored one (same iframe, quizzes, RTL), so that editing never degrades presentation.
18. As the system, I want an edited Lesson/Reference to replace its old content blob and clean up the previous one, so that storage doesn't accumulate orphans.

## Implementation Decisions

- **Content scope: body text only.** Lesson and Reference body HTML. No per-Lesson
  title editing (Topic title is already editable via `renameTopic`), no Mission
  (already editable), no reorder/retire/quiz-question editing, no Resource
  management — those remain in [course-authoring issue 02](../course-authoring/issues/02-direct-course-editing.md).

- **Lesson immutability — guarded in-place mutation (amends ADR 0003).** A published
  Lesson's *text* may be mutated in place by its owner **provided the quiz
  structure is unchanged**, reusing `quizStructureMatches(oldBody, newBody)` (equal
  counts of `data-correct` / `data-answer` / `data-k`). A structural change is
  **rejected**, not superseded, in this slice. ADR 0003 is amended to record this
  carve-out: *owner manual prose edits may mutate a Lesson in place; structural
  changes still require supersede (and supersede is out of scope here).* The
  ADR's core guarantee — Responses/Questions anchor to prompts that don't move —
  is exactly what the guard protects.

- **References — in-place mutation, no guard.** References are already mutable
  (ADR 0003); the edit takes the same write path minus the quiz guard.

- **Write path rides the content-blob contract, not inline `html`.** Because
  `.scratch/html-blob-storage/` drops the inline `html` field, edits are written
  as **content blobs**, mirroring that PRD's mutable-Reference re-publish
  (issue 03): the client requests an upload URL, `PUT`s the edited HTML to
  storage, and calls an owner-guarded mutation with the resulting `storageId`; the
  mutation runs the guard (Lessons/translations), swaps `htmlStorageId`, and
  **deletes the previous blob**. HTML never transits a Convex function. Editing is
  therefore **blocked by the blob-storage foundation + write path** (that PRD's
  issues 01–03).

- **Edit surface — `contentEditable` with authored fidelity.** The reader already
  fetches the body from the content URL and renders it in the sandboxed `<Frame>`
  iframe. The editor reuses that body: it renders in an edit surface whose
  `contentEditable` body is read back as HTML on save. To preserve the authored
  CSS/layout (and to keep injected content out of the parent DOM), the edit
  surface is an **iframe rendering the same srcDoc with editing enabled**, not a
  bare `contentEditable` div in the parent. The parent reads the edited body out
  via the existing quiz `postMessage` bridge pattern. (Mechanism is a build
  detail; the decision is "visual fidelity, no raw-HTML textarea, no parent-DOM
  style leakage.")

- **New owner-guarded mutations, highest seam.** Add owner-edit mutations that
  accept a `topicSlug`, an item `key`, an optional `lang` (absent = source
  edition), and a `storageId`. Resolve the Topic via the existing
  `getOwnedTopic` guard; branch on kind: Lesson (source) → guard + patch
  `lessons.htmlStorageId`; Reference (source) → patch `references.htmlStorageId`
  (no guard); translated item → guard (lesson kind) + patch the `translations`
  row's `htmlStorageId`. Each deletes the prior blob. These reuse the resolvers
  and blob-swap already established for publish.

- **Visibility — immediate and silent.** No draft/publish gate, no "updated"
  marker. Convex reactivity pushes the new content URL to readers on the next
  tick. Issue-02's "visible version bump" requirement is **consciously deferred**.

- **Owner-only affordance.** The pencil renders only in the authed owner reader
  (`ArtifactView` / `CourseShell` surface), never in the Viewer or Guest
  (`PublicReader`) paths. UI hiding is convenience; the server guard is the
  actual control.

## Testing Decisions

- **Good tests assert external behavior at a seam, not internals** — convex-test
  style: seed Users/Topics/Lessons/References/translations with `t.run`, act as a
  caller via `withIdentity`, assert what each caller can do and what the read seam
  then returns. Prior art: [`convex/content.test.ts`](../../convex/content.test.ts),
  [`convex/sharing-readonly.test.ts`](../../convex/sharing-readonly.test.ts),
  [`convex/translate.test.ts`](../../convex/translate.test.ts), and the
  `resources` blob dedupe/delete test (`ctx.db.system.get(storageId)` → null).

- **One seam — the owner-edit mutation API** (extending `content.test.ts`):
  - Owner can edit a **source Lesson**, a **Reference**, and a **translated-Edition**
    Lesson; the read seam then returns the new body; the old blob is deleted.
  - A **Viewer**, a **Guest**, and any **non-owner** are rejected by the mutation.
  - The **quiz-structure guard** rejects a save that changes
    `data-correct`/`data-answer`/`data-k` counts (Lesson + translated Lesson) and
    **accepts** a prose-only edit; a **Reference** save is accepted regardless
    (no guard).
  - A translated-Edition edit patches the `translations` row and **leaves the
    English source unchanged**.

- **No automated frontend test.** The repo has no component-test infra; the
  hover pencil and `contentEditable` panel are verified by eye, consistent with
  how topic-sharing, course-completion, and the blob-storage PRD handle reader UI.

## Out of Scope

- **Supersede-on-structural-change.** A structural edit is rejected, not
  superseded; superseding a Lesson from the UI stays in issue 02.
- **Reorder / retire / hide Lessons, quiz-question editing, Resource management** — issue 02.
- **Draft / publish reader-visibility gate and version bumps** — the
  [internal-course-studio PRD](../internal-course-studio/PRD.md) and issue 02.
- **AI-assisted editing** — [course-authoring issue 01](../course-authoring/issues/01-ai-assisted-course-editing.md).
- **Editing titles / Mission from the pencil** — already covered elsewhere.
- **Raw-HTML editing mode.** The surface is visual only in this slice.

## Further Notes

- This feature is a hard **downstream** of the content-blob migration: it writes
  through `htmlStorageId` and the upload-URL pattern. If that migration's write
  path (issue 03) is not yet landed, this feature waits — building against inline
  `html` would be thrown away within days.
- The `contentEditable`-in-iframe read-back is the one genuinely new piece of
  UI plumbing; everything server-side reuses the publish blob-swap and the
  `getOwnedTopic` guard.
