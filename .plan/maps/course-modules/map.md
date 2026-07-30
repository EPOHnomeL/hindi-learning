# Course modules

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A decision on whether a course gains **Modules** — named, ordered groups of Lessons — with
per-module unlocking, and how that survives contact with the single linear Frontier and the
per-Edition Entitlement grain.

## Notes

- **Vocabulary tension, flagged at filing:** CONTEXT.md currently lists *"module"* under
  Lesson's **Avoid**. This map either overturns that entry or picks a different term — it
  cannot quietly ignore it. Run `/domain-modeling`.
- Today a course is one flat linear Lesson sequence and access is all-or-nothing (ownership,
  Share, Public link, or a per-Edition Entitlement).
- **The Frontier is the hard part:** the Routine authors a buffer of one against a single
  linear frontier. Module boundaries either respect that gate or change it.
- Access at module grain interacts with ADR 0016's per-Edition Entitlement — a finer grain is
  a marketplace change, not just a UI grouping.
- **Reconcile with**
  [pedagogy/01](../pedagogy/tickets/01-scope-learning-pyramid-phases.md): if phases are
  structural, "are phases within modules?" is the same question from the other side. Ticket
  01 there names this reconciliation as part of its deliverable.
- ADR 0003 still holds: regrouping is ordering, never a rewrite.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

## Out of scope

- Folders/collections *over* courses — a different grain entirely
  ([course-organization](../course-organization/map.md)).
