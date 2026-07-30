---
type: grilling
blocked_by: []
---

# Public link content privacy controls (exclude Q&A etc.)

## Question

**Where it stands:** needs-triage — future. Filed during the issue-07 grill (2026-06-30); not

for now.

Vocabulary: [`CONTEXT.md`](../../../../CONTEXT.md) (**Public link**, **Guest**). Builds on `07-public-link-shares.md`.

## Want

A **Public link** exposes the *full mirror* by default (Lessons, References,
Resources, and the owner's Questions/Replies/Progress) — decided in 07 because a
public course's Q&A is a feature: a **Guest** benefits from the questions the
creator already asked. But some owners will want to share the *course* without
their *personal study trail*. Give the owner a per-Topic control to narrow what
a Public link reveals — e.g. a "don't share my questions" / "don't share my
progress" toggle — without touching the in-app **Share** path (Viewers always
see everything).

## Open questions (needs a design pass before building)

- **Granularity of the control.** One "hide my Q&A + Progress" switch, or
  independent toggles per facet (Q&A, Progress, Resources)?
- **Where it lives.** On the Topic (a field read by the public read seam), or on
  the Public link itself if 07 ever grows beyond one link per Topic.
- **Default.** Stays full-mirror (07's decision), with the control as opt-out —
  confirm we don't want privacy-by-default for public links.
- **Read seam.** The token-authorized public reads (from 07) gate each facet on
  the control, so excluded facets are never served to a Guest.

## Depends on

- **07** (the Public link, the Guest, and the token-authorized read seam).

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — confirmed absent, as expected for a future/needs-triage ticket: the public read seam serves the owner's Progress + Questions unconditionally (public.ts:123-162); no per-facet privacy field in the schema and no toggle mutation.

## Done when

The granularity, location, default, and read-seam questions are answered, and the control is either specced into implementation tickets or ruled out of scope.

<!-- Migrated 2026-07-30 from GitHub issue #102 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
<!-- Some links in this ticket were de-linked in the 2026-07-30 migration: their targets
     (.scratch PRDs, already-resolved sibling tickets, the retired product-direction
     roadmap) do not exist in the repo. The names are kept as prose for provenance. -->
