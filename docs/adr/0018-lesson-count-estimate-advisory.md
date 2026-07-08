---
status: proposed
---

# The lesson-count estimate is advisory — never a quota

The teaching Routine now reports a **soft estimate** of a course's eventual total
lesson count, stored on the Topic (`topics.estimatedLessons`) and shown to the
owner in the reader as `~N lessons` while the course is being built. This ADR
records the load-bearing constraint on that number: it is **display-only** and
must **never** become an input to authoring or termination.

## Context

The teaching model is deliberately **emergent**
([ADR 0015](0015-course-completion-and-certificates.md)): there is no fixed
syllabus and no lesson quota. The Routine authors one lesson at a time and stops
when the mission's "Success looks like" outcomes are substantially met — a
judgement, not a count. The
[ADR 0001](0001-asynchronous-hub-mediated-teaching-loop.md) loop has no notion of
a target length.

The estimate exists only to answer an owner's question — *"roughly how big will
this get?"* — while a course is mid-build. The teacher produces it as a by-product
of its own planning and refreshes it each run. Because it is a concrete number
attached to a course, there is a standing risk that a future change (or a
well-meaning reviewer) "closes the loop" by feeding it back into the Routine:
authoring lessons *up to* the estimate, warning when the actual count diverges
from it, or treating "reached the estimate" as a reason to stop. Any of these
would quietly convert the forecast into the fixed syllabus ADR 0015 rejects.

## Decision

- **The estimate is advisory and display-only.** It is a forecast the teacher
  revises freely each run. Its only consumer is the reader's `~N lessons` line.
- **It never gates authoring or termination.** Termination stays a judgement
  against the mission (ADR 0015 / the teach skill's "Terminating a Course"),
  independent of the estimate. The Routine must never author a lesson to reach the
  number, never stop because it reached the number, and never treat a gap between
  estimate and actual as a signal.
- **It is a *total*, clamped on read to never fall below the published lesson
  count** so it can't read as obviously wrong — but that clamp is cosmetic and does
  not feed back into authoring either.
- **No enforcement in code is possible or wanted.** The guarantee lives in the
  agent contract (`docs/routine-prompt.md`, teach `SKILL.md`) and in this record.
  The write path (`reportGeneration`) stores whatever number the teacher sends and
  reads it back for display; it has no authoring side-effects by construction.

## Consequences

- **ADR 0015 stands unchanged.** The emergent, quota-free model is preserved; the
  estimate sits strictly on top of it as a view.
- **Drift is expected and acceptable.** The number may jump between runs (e.g. a
  learner's question opens new ground); there is no "accuracy" to defend and no
  freshness chrome.
- **Future changes must honour this.** Anyone tempted to make the Routine author
  toward the estimate, or to surface an estimate-vs-actual delta as guidance,
  should treat that as reopening ADR 0015 — out of bounds without a new decision.
