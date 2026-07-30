# Access & learner insights

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A build-ready spec for an **owner-facing dashboard** of who a course is shared with and how
each of them is doing — the surface the redesigned Editions & sharing popup deliberately
dropped — including the backend that does not exist yet.

## Notes

- **Domain:** Share, Viewer, Edition, Progress, Question (CONTEXT.md).
- The popup shipped lean on purpose: invite-by-email + the public-link toggle only. The
  "who has access" list was cut *here*, not lost.
- Overlaps [topic-sharing/06](../topic-sharing/tickets/06-share-management.md) — the roster
  and revoke primitives partly ship already as `listEditionAccess` / `revokeShare`. Read
  that ticket's verification note before assuming a backend gap.
- Skills: `/grilling` + `/domain-modeling`; `convex:convex-expert` for any query shape.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **What "how they're doing" may honestly show.** Progress and Questions are the learner's
  own study trail; surfacing them to an owner is a privacy decision, not just a query.
  Interacts with [topic-sharing/08](../topic-sharing/tickets/08-public-link-content-privacy-controls.md).

## Out of scope

- The lightweight sharing actions themselves — already shipped in the popup.
