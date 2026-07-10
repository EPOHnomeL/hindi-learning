# 08 — Public link content privacy controls (exclude Q&A etc.)

Status: needs-triage — future. Filed during the issue-07 grill (2026-06-30); not
for now.

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Public link**, **Guest**). Builds on [`07-public-link-shares.md`](./07-public-link-shares.md).

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

- 2026-07-10 — Migrated to GitHub issue [#35](https://github.com/EPOHnomeL/hindi-learning/issues/35); GitHub is now the tracking home for this ticket.
