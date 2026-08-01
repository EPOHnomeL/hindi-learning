# Topic sharing follow-ups

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

Sharing's remaining edges closed: full owner-side share management with its edge cases, a
decision on whether an owner can share a course without also sharing their personal study
trail, and the owner-facing view of who has access and how they are doing.

## Notes

<!-- Ticket 09 arrived 2026-08-01 from the retired single-ticket `access-dashboard` map; it
     carries that map's context folded in under a "Context folded from" heading. -->

- **09 belongs here because it is the read side of 06 and the mirror of 08.** The
  [access dashboard](tickets/09-access-and-learner-insights-dashboard.md) *shows* an owner the
  roster that [share management](tickets/06-share-management.md) already half-ships
  (`listEditionAccess` / `revokeShare`) and the very learner facets
  [privacy controls](tickets/08-public-link-content-privacy-controls.md) may let people hide.
  Specced apart, the two would contradict each other.

- **Domain:** Share, Viewer, Public link, Guest (CONTEXT.md).
- **Most of this effort already shipped**, which is why numbering starts at 06 — `NN` is a
  permanent identity, never renumbered. Ticket 08 depends on ticket 07 (the Public link, the
  Guest, and the token-authorized read seam), which is done.
- **Read ticket 06's verification note before touching it.** A 2026-07-10 check found
  `listShares` and `unshareTopic` already shipped under different names
  (`listEditionAccess`, `revokeShare`) with the revoke UI in place, partly superseded by
  ADR 0020. The genuinely remaining scope is small: self-share refusal, and a topic-delete
  cascade that is **moot until a topic-delete mutation exists at all** — see
  [Delete button for courses](../course-management/tickets/01-delete-button-for-courses.md).
- **Ticket 08 inherits a decision, not a blank page:** a Public link exposes the *full mirror*
  by default, including the owner's Questions and Progress, because a public course's Q&A is a
  feature — a Guest benefits from the questions the creator already asked. The control is an
  **opt-out**, and confirming that (rather than flipping to privacy-by-default) is part of the
  ticket.
- Overlaps
  [Access & learner-insights dashboard](../topic-sharing/tickets/09-access-and-learner-insights-dashboard.md),
  which wants to *show* an owner the very facets ticket 08 may let them hide.
- Skills: `/tdd` (06 is a tested seam), `/grilling` (08 is a design pass),
  `convex:convex-authz` (a facet that is merely un-rendered is not hidden).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

## Out of scope

- The Public link and Share mechanisms themselves — shipped (ADR 0013, ADR 0020).
