---
type: grilling
blocked_by: []
---

# Progress feature

## Question

Add a progress bar when reading a lesson. 
Save last read in each course.
Save quiz answers for each user

## What already ships (2026-08-18, verified in the tree)

The folded note below says "most likely to be half-built already" and makes establishing that the
first session's job. Doing the read costs minutes, so here it is, on `main` @ `bf04257` — **evidence
from reading the code, not from walking a browser.** This does not resolve the ticket; the spec and
the implementation tickets are still owed.

- **"Save quiz answers for each user" — shipped, as a persistence *and* a read path.**
  `capture.recordResponse` (`convex/capture.ts:29`) inserts into `responses` with `quizId`,
  `answer` and `correct`, and `reviewState` (`capture.ts:133`) reads them back. This ask looks like
  a **display** gap at most, exactly as the folded note suspected.
- **"Save last read in each course" — shipped.** `progress` rows plus `resumeLessonKey` give
  open-to-last-completed: `CourseIndex` (`src/app/_components/CoursePanes.tsx`) waits for progress
  and redirects to the resume point in one hop rather than flashing through lesson 1.
- **A progress bar — shipped on the dashboard card, not in the reader.** The card renders
  `completedCount / lessonCount` as a percentage and a bar (`Dashboard.tsx`). `CourseShell` reads
  `myProgress` and marks completed lessons in the nav, but shows no percentage while reading —
  which is the literal ask ("a progress bar **when reading a lesson**").

So the honest remaining scope is close to one small ticket, plus a decision on whether the reader
wants a bar at all when the nav already ticks. Weigh that before writing three tickets.

## Done when

The three asks — a lesson progress bar, last-read per course, persisted quiz answers — are specced against the existing Progress/Response model, with implementation tickets opened.

<!-- Migrated 2026-07-30 from GitHub issue #85 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `progress-feature` map (2026-08-01)

<!-- was .plan/maps/learning-experience/tickets/03-progress-feature.md; that single-ticket map was consolidated into reader-experience -->

- **Most likely to be half-built already.** Progress, Completion, and Response all exist as
  concepts (CONTEXT.md), and the reader already tracks something. **First session's job is to
  establish what actually ships today** before writing a single ticket — this may collapse to
  one small implementation ticket.
- The three asks (progress bar while reading, last-read remembered per course, quiz answers
  persisted per user) are independent and separable; do not bundle them into one build.
- **"Save quiz answers for each user" already has a home:** a Response is the existing capture
  for a quiz prompt, and the Routine reads it for ZPD signal. Check whether this ask is a
  *persistence* gap or a *display* gap before adding schema.
- Downstream readers of Progress that constrain any change here:
  [Access & learner-insights dashboard](../../distribution/assets/deferred/learner-insights-dashboard.md)
  (an owner seeing learner progress),
  [Scope course audio](../../authoring/assets/deferred/course-audio.md) (does
  listening tick Progress?), and
  [Course modules](../../authoring/assets/deferred/modules-and-per-module-unlocking.md)
  (per-module progress rather than a course-wide count).
- Skills: `/ponytail`, `convex:convex-expert`, `/tdd`.
- **Out of scope:** Certificates and Completion — already shipped.

<!-- Moved 2026-09-01 from `reader-experience/01` during the .plan consolidation (33 map dirs to 7 active maps).
     Renumbered because `blocked_by` is map-local; the old number stays that ticket's identity in the donor map's history. -->
