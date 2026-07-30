# Course authoring

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A locked model for **how a course gets changed and by whom** — AI-instructed revision, direct
hand editing, and the self-serve front door where an ordinary user generates, translates, and
sells a course — with the review/approve gate that none of them have today.

## Notes

- **Domain:** Topic, Lesson, Reference, Question, Routine, Frontier, Mission (CONTEXT.md).
- **The hard constraint is ADR 0003:** Lessons are immutable, References mutable. "Edit a
  lesson" means *supersede with a revised one*; "delete" means *retire/hide*. Any ticket here
  that proposes mutating a Lesson in place has gone wrong.
- **ADR 0001 keeps the reader dumb** — edit-intents are structured directives, not free-form
  reader chat. (If free-form authoring chat is wanted, that's
  [ai-chat/01](../ai-chat/tickets/01-interactive-ai-chat-substrate.md)'s substrate, and a
  deliberate amendment.)
- Today's only authoring act is **seed-and-go**: title + why + Resources, then the Routine
  authors autonomously and lessons **auto-publish**. There is no draft/review state anywhere —
  building it is inside ticket 01, and it overlaps
  [internal-course-studio/01](../internal-course-studio/tickets/01-reader-visibility-gate.md),
  which builds the same gate from the visibility side. **Reconcile before building either.**
- Ticket 03 (self-serve) is the *pre-seed* front door; 01 is *post-seed* revision. Keeping
  that seam explicit is the point — they were filed separately for a reason.
- Ticket 03 inherits the metering question from
  [paid-marketplace/01](../paid-marketplace/tickets/01-authoring-cost-and-model-provider-strategy.md):
  a self-serve generate button is a metered LLM cost per click.
- Skills: `/grilling` + `/domain-modeling`, `convex:convex-expert`, `/ponytail`.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Who owns a course once building is delegated.** Ticket 03's access question needs the
  primitive from
  [course-ownership/01](../course-ownership/tickets/01-co-authorship-and-ownership-transfer.md);
  the two will need reconciling and one of them may absorb the other.
- **Version bumps visible to a learner mid-course.** Ticket 01 names the requirement (never
  silently change content someone has completed) but not the mechanism.

## Out of scope

- Translation itself — the Edition machinery already ships. Consumed here, never re-charted.
- Organising and pruning the resulting course list —
  [course-organization](../course-organization/map.md) and
  [course-delete](../course-delete/map.md).
