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
- [ ] Write the mutation. **Gate corrected 2026-08-27**: not owner-only like
      `renameTopic` but the body-edit `canEdit` gate (owner or that Edition's
      Editor), spec D2 and D4.
- [ ] Decide and implement what a source rename does to ready translated Editions
      (carry over, leave alone, or flag as stale). **Decided 2026-08-27**
      (spec D3): leave alone, matching the `editLesson` body precedent. The
      implement half is what keeps this box unticked.
- [ ] Build the rename UI. **The "settled UI" this item used to describe (a
      Rename button in the lesson bar's freed certificate slot) was superseded
      2026-08-27** by [editing-obviousness spec D5](../../editing-obviousness/spec.md):
      a title-side pencil turning the title into an inline field, both
      breakpoints, shared with References; the lesson-bar button is not coming
      back. The old prototype's record stays in
      `.plan/maps/ui-overhaul/assets/mobile-bottom-nav.md` (the prototype file
      itself, `AppTabsPrototype.tsx`, was deleted 2026-08-23 when variant D
      shipped without the rename button).
- [ ] Check the name is not cached anywhere that will now go stale (sidebar list,
      drawer, the Continue card on Home, certificate rendering).
- [ ] Test: rename, reload, and confirm the sidebar and drawer agree.

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
