---
type: task
blocked_by: []
---

# Give a lesson a name that can be changed

> `/wayfinder .plan/maps/mobile-reader-todos/tickets/03-rename-a-lesson.md`

## Question

The reader should let an owner rename the lesson they are looking at, from the
lesson bar. The UI for it is prototyped and settled (a Rename button in the bar,
an inline field over the title). **The backend does not exist**, and the reason it
does not is worth reading before starting.

Verified 2026-08-23, first claim corrected 2026-08-27:

- **A lesson DOES have a title field** (correction 2026-08-27: the 2026-08-23
  note claimed it did not). `lessons.title` has been a schema column since
  2026-06-11, populated at publish by parsing the blob's
  `<title>Lesson N · <display></title>` (`titleFrom`, `convex/authoring.ts`);
  the reader displays the column. What the original note got right is that no
  edit path reaches the title after publish.
- **No existing edit path can reach it.** The in-place content editor goes through
  `editLesson`, which applies `replaceBodyInner` (`lessonSrcDoc.ts`): that swaps
  the body inner HTML only, so `<head><title>` survives every edit untouched.
- **The course has a rename and the lesson does not.** `renameTopic` exists in
  `convex/content/authoring.ts`; there is no lesson equivalent.

So this needs a real mutation, and the decision inside it is where the name should
live: rewrite the `<title>` in the stored HTML (keeps one source of truth, but a
rename becomes a document write), or promote the display title to a column on the
lesson row (cheap to read and write, but now two places can disagree and every
generated lesson has to populate it).

Sequence matters: a translated Edition has its own lesson documents, so whichever
shape wins has to say what a rename does to the translations. Renaming the English
source and silently leaving five Editions on the old name is the failure mode.

## Done when

An owner can rename a lesson from the reader and the new name survives a reload,
appears in the sidebar and the drawer, and the `## Answer` records what happened to
the translated Editions.

## Todo

- [x] Decide: rewrite the document `<title>`, or add a title column to the lesson
      row. Record the reasoning, it is the load-bearing call here.
      **Decided 2026-08-27** (grilled, recorded in
      [editing-obviousness spec D1](../../editing-obviousness/spec.md)): the
      column already existed; a rename patches it AND splices the blob's
      `<title>` display part so document and row never disagree.
- [x] Write the mutation. **Gate corrected 2026-08-27**: not owner-only like
      `renameTopic` but the body-edit `canEdit` gate (owner or that Edition's
      Editor), spec D2 and D4.
- [x] Decide and implement what a source rename does to ready translated Editions
      (carry over, leave alone, or flag as stale). **Decided 2026-08-27**
      (spec D3): leave alone, matching the `editLesson` body precedent. The
      implement half is what keeps this box unticked.
- [x] Build the rename UI. **The "settled UI" this item used to describe (a
      Rename button in the lesson bar's freed certificate slot) was superseded
      2026-08-27** by [editing-obviousness spec D5](../../editing-obviousness/spec.md):
      a title-side pencil turning the title into an inline field, both
      breakpoints, shared with References; the lesson-bar button is not coming
      back. The old prototype's record stays in
      `.plan/maps/ui-overhaul/assets/mobile-bottom-nav.md` (the prototype file
      itself, `AppTabsPrototype.tsx`, was deleted 2026-08-23 when variant D
      shipped without the rename button).
- [x] Check the name is not cached anywhere that will now go stale (sidebar list,
      drawer, the Continue card on Home, certificate rendering).
      **Checked 2026-08-31 by reading the code:** all three read titles through
      reactive `listLessons` / `listReferences` queries, so a rename propagates
      with no extra work, and `convex/certificates.ts` snapshots the COURSE title
      plus lesson count, never lesson titles.
- [ ] Test: rename, reload, and confirm the sidebar and drawer agree.
      **Still open 2026-08-31:** covered by automated tests
      (`convex/content/authoring.test.ts`), NOT by a browser walk. No dev server
      was listening in the building session, so nobody has yet watched a rename
      land in the sidebar.

## Notes

- **2026-08-27:** every open decision in this ticket was resolved in the
  [editing-obviousness spec](../../editing-obviousness/spec.md) (grilled with
  the operator; the course author, an Editor, asked for "editing the chapter
  titles"). The build lands under that effort and the building session writes
  this ticket's `## Answer` too. Until then this ticket stays open: decided,
  NOT built.
- The prototype deliberately ships a field that does **not** save and says so on
  screen, rather than pretending. See `MobileNavPrototype.NOTES.md`.
- Related but separate: ticket 01 takes the certificate control off this same bar,
  which is what freed the space the Rename button now uses.
## Answer

**Built and shipped 2026-08-31** under the
[editing-obviousness](../../editing-obviousness/map.md) effort, in a different UI
shape than D5 had settled.

- **The name is edited in the in-place editor, not from a title-side pencil.** The
  operator asked for title editing "in the editor view" on 2026-08-31, so the
  `ContentEditor` modal gained a Title field above the body editor
  (`src/app/_components/ArtifactView.tsx`): one save writes the body and the name
  together, through one already-guarded write path, and there is one affordance to
  find instead of two. This **supersedes spec D5** (a pencil on the title in the
  reader). No rename control was added to the reader chrome at all, so the mobile
  lesson bar stays exactly as variant D shipped it.
- **What a save writes (D1 holds).** The client splices the new display string into
  the uploaded document's head `<title>`, preserving the `Lesson N · ` /
  `Reference · ` prefix that `titleFrom` parses (`replaceTitleDisplay`,
  `lessonSrcDoc.ts`), and sends the same string as a `title` arg. The write path
  patches the row's `title` column, which is what the reader renders, so document
  and row agree and the column is the authority.
- **Gate = the body-edit gate (D2 holds).** No new mutation and no new resolver for
  the rename: the four write paths (`editLesson`, `editReference`,
  `editTranslatedLesson`, and the new `editTranslatedReference`) each took an
  optional `title` arg, so `getEditableTopic` already decides who may rename what.
  An Editor renames what they may rewrite.
- **Translated Editions (D3 and D4 hold).** A source rename leaves ready Editions
  alone; a translated save patches that Edition's own `translations.title`. Both
  directions are covered by test.
- **Blank means keep.** An absent or whitespace-only `title` leaves the column
  alone (`titlePatch`), so a body-only save can never clear a name.

Evidence: `pnpm typecheck` clean, `pnpm test` green (978 tests), including new
cases for a source rename, a translated-Edition rename, and the blank-title case.
The read-side staleness check was done by reading the code, not by walking a
browser. See the last Todo box for what a human still has to look at.
