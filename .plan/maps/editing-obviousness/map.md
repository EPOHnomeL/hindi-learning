# Editing obviousness

## Destination

An Editor opening their course cannot miss that they can edit it: the Edit
button is always visible (never hover-revealed), Lesson and Reference titles
are renameable in place, and the sidebar Resources are shown by default. Done
when the four units in [spec.md](spec.md) are shipped and the course author who
asked has actually used them.

## Notes

- **Driver (2026-08-27):** the course author, an Editor on their course, was
  asked what is blocking them and answered "editing the references would help
  me to continue... or editing the chapter titles". Reference *body* editing
  already existed for their role; they never found the hover-revealed pencil.
  "Chapter titles" is their word for Lesson titles, which nothing could edit.
- **This map carries build tickets, deliberately** (wayfinder override): every
  decision was made in the 2026-08-27 grilling and lives in [spec.md](spec.md).
  What remains is doing, not deciding.
- **Lesson rename shares history with
  [mobile-reader-todos ticket 03](../mobile-reader-todos/tickets/03-rename-a-lesson.md).**
  That ticket raised the rename first (2026-08-23); its open decisions were
  resolved by this spec on 2026-08-27, and the session that shipped the rename
  wrote its `## Answer` on 2026-08-31, so it is now **resolved**. Two corrections
  to this bullet as it stood: the ticket's earlier "settled UI" (a Rename button
  in the lesson bar) was superseded by spec D5's title-side pencil, and D5 was in
  turn superseded on 2026-08-31 by **D10**, a Title field in the editor view.
  Neither the pencil nor the bar button was ever built.
- **Shipped 2026-08-31, without cutting tickets first:** the operator asked
  directly for "glossary and reference editing for other languages and also
  lesson titles editing in the editor view preferably", so that session built it
  against the spec instead of ticketing it. Landed: **unit 4** (rename, in the
  editor view rather than D5's title-side pencil, see spec D10) and
  **translated-Edition Reference editing** (spec D9, which supersedes D8 and the
  out-of-scope line this map used to carry). Still open: **units 1, 2 and 3**,
  the whole discoverability half of the Destination, plus the browser walk that
  [mobile-reader-todos ticket 03](../mobile-reader-todos/tickets/03-rename-a-lesson.md)
  now names as its one remaining box.

## Decisions so far

<!-- one line per resolved ticket -->

_None yet. The grilling's answers are recorded in [spec.md](spec.md); tickets
are not yet cut._

## Not yet specified

- Tickets for **units 1, 2 and 3**, the unbuilt discoverability half. The spec
  is complete and their decisions are made (2026-08-27), so this is a cutting
  job, not a deciding one; unit 4 and D9 shipped without tickets on 2026-08-31.

## Out of scope

- Persisting the Resources open/closed toggle anywhere.
- Any change to who holds the Editor role or what else it may do (ADR 0020
  stands).
- Rewriting anything inside authored Lesson bodies beyond the head `<title>`
  splice a rename performs; body prose stays the pencil's job.
