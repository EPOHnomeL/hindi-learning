# Topic sharing follow-ups

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

Sharing's remaining edges closed: full owner-side share management with its edge cases, and a
decision on whether an owner can share a course without also sharing their personal study
trail.

## Notes

- **Domain:** Share, Viewer, Public link, Guest (CONTEXT.md).
- **Most of this effort already shipped**, which is why numbering starts at 06 — `NN` is a
  permanent identity, never renumbered. Ticket 08 depends on ticket 07 (the Public link, the
  Guest, and the token-authorized read seam), which is done.
- **Read ticket 06's verification note before touching it.** A 2026-07-10 check found
  `listShares` and `unshareTopic` already shipped under different names
  (`listEditionAccess`, `revokeShare`) with the revoke UI in place, partly superseded by
  ADR 0020. The genuinely remaining scope is small: self-share refusal, and a topic-delete
  cascade that is **moot until a topic-delete mutation exists at all** — see
  [course-delete/01](../course-delete/tickets/01-delete-button-for-courses.md).
- **Ticket 08 inherits a decision, not a blank page:** a Public link exposes the *full mirror*
  by default, including the owner's Questions and Progress, because a public course's Q&A is a
  feature — a Guest benefits from the questions the creator already asked. The control is an
  **opt-out**, and confirming that (rather than flipping to privacy-by-default) is part of the
  ticket.
- Overlaps
  [access-dashboard/01](../access-dashboard/tickets/01-access-and-learner-insights-dashboard.md),
  which wants to *show* an owner the very facets ticket 08 may let them hide.
- Skills: `/tdd` (06 is a tested seam), `/grilling` (08 is a design pass),
  `convex:convex-authz` (a facet that is merely un-rendered is not hidden).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

## Out of scope

- The Public link and Share mechanisms themselves — shipped (ADR 0013, ADR 0020).
