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
  out-of-scope line this map used to carry). Still open after it: **units 2 and
  3** (unit 1 followed later the same day, see the next bullet), plus the browser
  walk that
  [mobile-reader-todos ticket 03](../mobile-reader-todos/tickets/03-rename-a-lesson.md)
  now names as its one remaining box.
- **Unit 1 shipped 2026-08-31 too**, asked for directly once the rename was in:
  the Edit button no longer hides itself behind a desktop hover. That was the
  original driver's actual blockage.
- **Units 2 and 3 shipped 2026-08-31 as well**, so the whole spec is built: the
  button is accent-styled with a real pencil icon, and Resources are open by
  default in both readers. **The Destination is not met yet**, and cannot be met
  by a session: its second half is that the course author who asked has actually
  used these, and nobody has walked any of it in a browser (no dev server was
  listening on the day). That, plus
  [mobile-reader-todos ticket 03](../mobile-reader-todos/tickets/03-rename-a-lesson.md)'s
  last open box, is all that stands between this map and done.

## Decisions so far

<!-- one line per resolved ticket -->

_None yet. The grilling's answers are recorded in [spec.md](spec.md); tickets
are not yet cut._

## Not yet specified

- Nothing. All four units and D9 shipped on 2026-08-31 without tickets ever
  being cut, so no planning work is left here. What remains is not
  specification: a human has to look at it.

## Out of scope

- Persisting the Resources open/closed toggle anywhere.
- Any change to who holds the Editor role or what else it may do (ADR 0020
  stands).
- Rewriting anything inside authored Lesson bodies beyond the head `<title>`
  splice a rename performs; body prose stays the pencil's job.
