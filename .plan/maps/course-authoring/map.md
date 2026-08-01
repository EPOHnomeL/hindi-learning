# Course authoring

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A locked model for **how a course gets authored and changed, by whom, and at what cost** —
AI-instructed revision, direct hand editing, the self-serve front door, the review/approve
gate none of them have today, and the economics of the Routine run underneath all of it.

## Notes

<!-- Tickets 04–06 arrived 2026-08-01 from three retired single-ticket maps
     (authoring-efficiency, scheduled-authoring, copyright-scan). Each carries its old
     map's context folded into the ticket under a "Context folded from" heading. -->

- **Two halves, one map.** Tickets 01–03 are *who may change a course and how*; tickets 04–06
  are *what a Routine run costs and whether its output is safe to sell*. They share one
  subject — the authoring pipeline — and one recurring dependency, per-run cost numbers.
- **[Streamline the Routine's effort](tickets/04-streamline-routine-effort.md) is the
  high-priority one.** Every Routine run pays that tax and it compounds as Topics grow; it
  directly bounds Claude spend. **[Off-peak generation](tickets/05-off-peak-course-generation.md)
  multiplies each run by a whole curriculum, so 04 should land first**, and both want the
  numbers from
  [Cost instrumentation](../internal-course-studio/tickets/03-cost-instrumentation.md).
- **05 asks to remove a safety mechanism**, not to add a feature: the buffer-of-one gate is a
  deliberate cost throttle. That is why it is Admin-only (ADR 0011) and why a per-run Lesson
  cap is not optional.
- **[Copyright scan](tickets/06-scan-for-copyright-feature.md) is the sell-safety gate** on
  authored output — narrow and specific (verbatim protected expression, CC BY-SA
  contamination, cloned selection/arrangement), never a general plagiarism engine.

- **Domain:** Topic, Lesson, Reference, Question, Routine, Frontier, Mission (CONTEXT.md).
- **The hard constraint is ADR 0003:** Lessons are immutable, References mutable. "Edit a
  lesson" means *supersede with a revised one*; "delete" means *retire/hide*. Any ticket here
  that proposes mutating a Lesson in place has gone wrong.
- **ADR 0001 keeps the reader dumb** — edit-intents are structured directives, not free-form
  reader chat. (If free-form authoring chat is wanted, that's
  [Interactive AI chat](../pedagogy/tickets/04-interactive-ai-chat-substrate.md)'s substrate, and a
  deliberate amendment.)
- Today's only authoring act is **seed-and-go**: title + why + Resources, then the Routine
  authors autonomously and lessons **auto-publish**. There is no draft/review state anywhere —
  building it is inside ticket 01, and it overlaps
  [Reader visibility gate](../internal-course-studio/tickets/01-reader-visibility-gate.md),
  which builds the same gate from the visibility side. **Reconcile before building either.**
- Ticket 03 (self-serve) is the *pre-seed* front door; 01 is *post-seed* revision. Keeping
  that seam explicit is the point — they were filed separately for a reason.
- Ticket 03 inherits the metering question from
  [Authoring-cost funding & model-provider strategy](../marketplace/tickets/01-authoring-cost-and-model-provider-strategy.md):
  a self-serve generate button is a metered LLM cost per click.
- Skills: `/grilling` + `/domain-modeling`, `convex:convex-expert`, `/ponytail`.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Who owns a course once building is delegated.** Ticket 03's access question needs the
  primitive from
  [Co-authorship / ownership transfer](../course-management/tickets/03-co-authorship-and-ownership-transfer.md);
  the two will need reconciling and one of them may absorb the other.
- **Version bumps visible to a learner mid-course.** Ticket 01 names the requirement (never
  silently change content someone has completed) but not the mechanism.
- **What happens when an overnight run fails halfway** (ticket 05). Unattended work needs a
  failure story a human reads in the morning; not yet sharp enough to ticket.
- **Cost instrumentation for a copyright-scan run** (ticket 06) — sharpens once the trigger
  model (on publish / on demand / cron) is fixed.

## Out of scope

- Translation itself — the Edition machinery already ships. Consumed here, never re-charted.
- Organising and pruning the resulting course list —
  [course-management](../course-management/map.md).
- Changing the teaching loop's shape (ADR 0001) — the loop is a standing decision, not a
  ticket here.
- Opening off-peak generation to ordinary owners — the whole point is that it is admin-gated.
- A general-purpose plagiarism checker, or anything rendering a legal judgement.
