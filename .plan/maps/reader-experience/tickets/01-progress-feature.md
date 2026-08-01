---
type: grilling
blocked_by: []
---

# Progress feature

## Question

Add a progress bar when reading a lesson. 
Save last read in each course.
Save quiz answers for each user

## Done when

The three asks — a lesson progress bar, last-read per course, persisted quiz answers — are specced against the existing Progress/Response model, with implementation tickets opened.

<!-- Migrated 2026-07-30 from GitHub issue #85 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `progress-feature` map (2026-08-01)

<!-- was .plan/maps/reader-experience/tickets/01-progress-feature.md; that single-ticket map was consolidated into reader-experience -->

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
  [Access & learner-insights dashboard](../../topic-sharing/tickets/09-access-and-learner-insights-dashboard.md)
  (an owner seeing learner progress),
  [Scope course audio](../../media-generation/tickets/02-scope-course-audio.md) (does
  listening tick Progress?), and
  [Course modules](../../course-management/tickets/04-modules-and-per-module-unlocking.md)
  (per-module progress rather than a course-wide count).
- Skills: `/ponytail`, `convex:convex-expert`, `/tdd`.
- **Out of scope:** Certificates and Completion — already shipped.
