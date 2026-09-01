---
type: task
blocked_by: [04]
---

# "Share with the company" entry point + draft-gating

## Question

**Where it stands:** open — sharing mechanisms exist, but draft-gating (needs issue 01) is not built

Vocabulary: [`CONTEXT.md`](../../../../CONTEXT.md) (Share, Public link, Viewer, Guest, Topic). Spec: `../PRD.md`. Respects [ADR 0013](../../../../docs/adr/0013-public-link-shares.md) (Public link mint/revoke semantics).

## What to build

A prominent **"share with the company"** entry point on a published course, surfacing the existing **Share** (by email) and **Public link** (anonymous) mechanisms — which are reused unchanged. Distribution is **blocked while the course is a draft**: a course can only be shared or made public once it has been published to readers (issue 01). End-to-end: owner publishes → shares (link or email) → an employee reads it.

## Acceptance criteria

- [ ] A published course shows a clear, non-buried "share with the company" action.
- [ ] A draft course cannot be shared by email or made public; the action is disabled in the UI **and** rejected server-side with a clear reason.
- [ ] Once published, the owner can mint / turn off / regenerate a Public link (existing behavior) and grant / revoke an email Share (existing behavior).
- [ ] A Guest opening a Public link for a course that is draft (or has been unpublished) gets "not available", never draft content.
- [ ] Tests: distribution mutations reject while draft and succeed once published; a Guest cannot reach content after the course is unpublished.

## Blocked by

- Issue **01** (reader-visibility state) — distribution gating keys off the published state.

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding as written: sharing primitives exist (`shareTopic`, `setTopicPublic`, `setEditionPublic`) but there is no "share with the company" entry point, and none of the share mutations checks any draft state (none exists — blocked on #23).

## Done when

A published course exposes a clear, non-buried share action; a draft course refuses distribution both in the UI and server-side; tests cover both directions.

<!-- Migrated 2026-07-30 from GitHub issue #74 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
<!-- Some links in this ticket were de-linked in the 2026-07-30 migration: their targets
     (.scratch PRDs, already-resolved sibling tickets, the retired product-direction
     roadmap) do not exist in the repo. The names are kept as prose for provenance. -->

<!-- Moved 2026-09-01 from `internal-course-studio/02` during the .plan consolidation (33 map dirs to 7 active maps).
     Renumbered because `blocked_by` is map-local; the old number stays that ticket's identity in the donor map's history. Its blocker followed it: internal-course-studio/01 is now 04 here. -->
