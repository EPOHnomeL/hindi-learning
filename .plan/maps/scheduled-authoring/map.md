# Scheduled authoring

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A decision on an **admin-only** mode that authors a whole course unattended during off-peak
hours — deliberately bypassing the buffer-of-one cost throttle — with guardrails that make
that safe.

## Notes

- **Today's behaviour is a deliberate cost throttle, not a limitation.** Both the daily
  `dailyFire` cron (04:23 UTC) and the on-demand reader button author only the **next** Lesson,
  and only once the learner has completed the Frontier. A course is built incrementally as the
  learner advances, which bounds Claude usage.
- **So this ticket is asking to remove a safety mechanism.** That is why it is Admin-only
  (ADR 0011 allowlist) and why a **per-run Lesson cap** is not optional — without it a single
  overnight run can spike usage without bound.
- The on-demand admin finisher already shipped; what remains is the *scheduled, off-peak*
  half. Verify what exists before building.
- Completion is the natural stopping condition: loop until the Mission's "success looks like"
  outcomes are met.
- Relates to ADR 0001 (async hub-mediated loop), ADR 0008 (the next-lesson gate),
  `convex/crons.ts`.
- **Pairs with**
  [internal-course-studio/03](../internal-course-studio/tickets/03-cost-instrumentation.md):
  running unattended overnight is precisely when you want per-run token numbers, and
  [authoring-efficiency/01](../authoring-efficiency/tickets/01-streamline-routine-effort.md)
  makes each run cheaper before you multiply it by a whole curriculum. Consider doing both
  first.
- Skills: `/grilling`, `convex:convex-crons`, `convex:convex-expert`.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **What happens when an overnight run fails halfway.** Unattended work needs a failure story
  a human reads in the morning; not yet sharp enough to ticket.

## Out of scope

- Opening this to ordinary owners — the whole point is that it is admin-gated.
