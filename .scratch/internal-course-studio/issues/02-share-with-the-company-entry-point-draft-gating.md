# internal-course-studio/02: "Share with the company" entry point + draft-gating

**Status:** open — sharing mechanisms exist, but draft-gating (needs issue 01) is not built
**Depends on:** issue **01** (reader-visibility state) — distribution gating keys off the published state
**Imported:** from GitHub #24 on 2026-07-15 (created 2026-07-10; GitHub issue deleted after import)

> Migrated from [`.scratch/internal-course-studio/issues/02-share-with-the-company.md`](https://github.com/EPOHnomeL/hindi-learning/blob/93ad1e399b426e882c40d9422d8691e1dfb3a46b/.scratch/internal-course-studio/issues/02-share-with-the-company.md) on 2026-07-10. Relative links in the text resolve against that file's location.

## Why

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Share, Public link, Viewer, Guest, Topic). Spec: [`../PRD.md`](../PRD.md). Respects [ADR 0013](../../../docs/adr/0013-public-link-shares.md) (Public link mint/revoke semantics).

A prominent **"share with the company"** entry point on a published course, surfacing the existing **Share** (by email) and **Public link** (anonymous) mechanisms — which are reused unchanged. Distribution is **blocked while the course is a draft**: a course can only be shared or made public once it has been published to readers (issue 01). End-to-end: owner publishes → shares (link or email) → an employee reads it.

## Acceptance criteria

- [ ] A published course shows a clear, non-buried "share with the company" action.
- [ ] A draft course cannot be shared by email or made public; the action is disabled in the UI **and** rejected server-side with a clear reason.
- [ ] Once published, the owner can mint / turn off / regenerate a Public link (existing behavior) and grant / revoke an email Share (existing behavior).
- [ ] A Guest opening a Public link for a course that is draft (or has been unpublished) gets "not available", never draft content.
- [ ] Tests: distribution mutations reject while draft and succeed once published; a Guest cannot reach content after the course is unpublished.

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding as written: sharing primitives exist (`shareTopic`, `setTopicPublic`, `setEditionPublic`) but there is no "share with the company" entry point, and none of the share mutations checks any draft state (none exists — blocked on #23).
