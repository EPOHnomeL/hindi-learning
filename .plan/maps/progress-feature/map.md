# Progress

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

Three concrete learner-facing wants specced against the existing Progress model: a progress
bar while reading a lesson, last-read remembered per course, and quiz answers persisted per
user.

## Notes

- **Smallest map here, and the one most likely to be half-built already.** Progress,
  Completion, and Response all exist as concepts (CONTEXT.md), and the reader already tracks
  something. **First session's job is to establish what actually ships today** before writing
  a single ticket — this may collapse to one small implementation ticket.
- The three asks are independent and separable; do not bundle them into one build.
- **"Save quiz answers for each user" already has a home:** a Response is the existing capture
  for a quiz prompt, and the Routine reads it for ZPD signal. Check whether this ask is a
  *persistence* gap or a *display* gap before adding schema.
- Downstream readers of Progress that constrain any change here:
  [access-dashboard/01](../access-dashboard/tickets/01-access-and-learner-insights-dashboard.md)
  (an owner seeing learner progress),
  [course-media/02](../course-media/tickets/02-scope-course-audio.md) (does listening tick
  Progress?), and
  [course-modules/01](../course-modules/tickets/01-modules-and-per-module-unlocking.md)
  (per-module progress rather than a course-wide count).
- Skills: `/ponytail`, `convex:convex-expert`, `/tdd`.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

## Out of scope

- Certificates and Completion — already shipped.
