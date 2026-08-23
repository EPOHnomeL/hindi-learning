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

Verified 2026-08-23:

- **A lesson has no title field.** The name is parsed out of the lesson document's
  `<title>Lesson N . <display></title>` (see the comment at the top of
  `convex/content/authoring.ts`). It is content, not metadata.
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

- [ ] Decide: rewrite the document `<title>`, or add a title column to the lesson
      row. Record the reasoning, it is the load-bearing call here.
- [ ] Write the mutation, owner-gated the same way `renameTopic` is.
- [ ] Decide and implement what a source rename does to ready translated Editions
      (carry over, leave alone, or flag as stale).
- [ ] Rebuild the settled UI (a Rename button in the lesson bar's freed
      certificate slot, an inline field over the title) and wire it to the
      mutation. The prototype that carried it (`AppTabsPrototype.tsx`) was
      deleted 2026-08-23 when variant D shipped WITHOUT the rename button, a
      "Not saved" field being worse than an empty slot; the UI's record is in
      `.plan/maps/ui-overhaul/assets/mobile-bottom-nav.md`.
- [ ] Check the name is not cached anywhere that will now go stale (sidebar list,
      drawer, the Continue card on Home, certificate rendering).
- [ ] Test: rename, reload, and confirm the sidebar and drawer agree.

## Notes

- The prototype deliberately ships a field that does **not** save and says so on
  screen, rather than pretending. See `MobileNavPrototype.NOTES.md`.
- Related but separate: ticket 01 takes the certificate control off this same bar,
  which is what freed the space the Rename button now uses.
