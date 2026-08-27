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
  That ticket raised the rename first (2026-08-23) and stays open until the
  build ships; its open decisions were resolved by this spec on 2026-08-27, and
  the session that ships the rename writes its `## Answer` too. Its earlier
  "settled UI" (a Rename button in the lesson bar) is superseded by this spec's
  title-side pencil.

## Decisions so far

<!-- one line per resolved ticket -->

_None yet. The grilling's answers are recorded in [spec.md](spec.md); tickets
are not yet cut._

## Not yet specified

- Tickets. The spec is complete; cutting it into tickets is the next planning
  step.

## Out of scope

- Editing translated References (their body edit is source-only today; titles
  match it, see spec D8).
- Persisting the Resources open/closed toggle anywhere.
- Any change to who holds the Editor role or what else it may do (ADR 0020
  stands).
- Rewriting anything inside authored Lesson bodies beyond the head `<title>`
  splice a rename performs; body prose stays the pencil's job.
