# Mobile reader todos

## Destination

A short queue of small, self-contained fixes to the mobile reader chrome, each one
shippable in well under a session. Done when every ticket carries an `## Answer`
and nothing here is waiting on a decision from the
[UI/UX overhaul](../ui-overhaul/map.md).

## Notes

- **Moved out 2026-09-01** in the `.plan` consolidation, which took 33 map directories
  down to 7 active maps. Ticket 04 (walk the mobile bottom nav) is now
  [learning-experience/07](../learning-experience/tickets/07-walk-the-bottom-nav.md) and
  ticket 05 (the Editor's Details door on a translated Edition) is now
  [authoring/08](../authoring/tickets/08-editor-details-door.md), split by subject rather
  than by device: one is a learner surface and one is an authoring affordance. The four
  resolved tickets stay, so this map is closed.

  Renumbering was forced: `blocked_by` is map-local and the numbers collided across the
  donor maps. **Do not reuse the old numbers here**, they remain those tickets' identity in
  this map's history, and do not mint a replacement for a moved ticket.

- **This map carries build tickets, deliberately.** wayfinder plans by default and
  permits the override only here: everything on this map is a `task` that *does*
  rather than decides. That is the entire point of it. Small chores surfaced while
  prototyping should not be carried in a session's head, and they should not be
  bolted onto a planning map either.
- Raised **2026-08-23** while prototyping a mobile bottom nav for the course
  reader (`src/app/_components/MobileNavPrototype.NOTES.md`). The bottom-nav
  decision itself is **not** here, it belongs to ui-overhaul; these are the chores
  that turned out to be independent of which variant wins.
- Each ticket carries a `## Todo` checklist. Tick items as they land, but the
  `## Answer` is still what resolves the ticket.
- Two further defects were found in the same pass and are deliberately **not**
  ticketed here, because both are entangled with the bottom-nav verdict:
  an **owner has no forward navigation on a phone** (the next-lesson link in the
  reader top bar is gated on `readOnly`, so a shared Viewer gets it and the owner
  does not), and the **"Mark complete" FAB sits exactly where any bottom bar
  goes** (`fixed bottom-6 right-6`), while also being the only way to mark a
  lesson complete on mobile. Both are written up in the prototype notes above.
  If the bottom-nav verdict lands and leaves either unfixed, ticket them here.
  **Both fixed 2026-08-23** when variant D shipped: the end-of-lesson card
  (`LessonFoot.tsx`, in both readers) gives every role forward navigation, and
  the FAB survives only where there is no next lesson, lifted above the tab bar.
  The prototype notes moved to `.plan/maps/ui-overhaul/assets/mobile-bottom-nav.md`.

## Decisions so far

<!-- one line per resolved ticket -->

- [Certificate off the lesson bar](tickets/01-certificate-off-the-lesson-bar.md):
  pill removed 2026-08-23; Home carries it, the reader keeps no certificate CTA
  (the celebration and the last lesson's "Finish course" own that moment).
- [Finish course on the last lesson](tickets/02-finish-course-on-the-last-lesson.md):
  "Finish course" shipped 2026-08-23 in all five locales, gated on
  `courseCompleted && !nextLessonKey`; the FAB's hardcoded English went with it.

## Not yet specified

_Nothing._ This map is a queue, not an exploration. A fix that turns out to need a
decision belongs on [ui-overhaul](../ui-overhaul/map.md) instead of growing fog
here.

## Out of scope

- Which bottom-nav variant wins, and what becomes of the lesson drawer:
  [ui-overhaul](../ui-overhaul/map.md).
- Redesigning the certificate surfaces themselves. Ticket 01 removes a duplicated
  control; it does not restyle anything.
- The owner-facing course lifecycle (ADR 0015). Ticket 02 touches only the
  learner-facing label, and must not be read as licence to reword the owner's
  "mark complete" in Course settings.
