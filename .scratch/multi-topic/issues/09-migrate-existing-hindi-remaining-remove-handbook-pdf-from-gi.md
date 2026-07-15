# multi-topic/09: Migrate existing Hindi — remaining: remove Handbook.pdf from git, confirm prod migration ran

**Status:** open
**Labels:** ready-for-human
**Imported:** from GitHub #31 on 2026-07-15 (created 2026-07-10; GitHub issue deleted after import)

> Migrated from [`.scratch/multi-topic/issues/09-migrate-existing-hindi.md`](https://github.com/EPOHnomeL/hindi-learning/blob/93ad1e399b426e882c40d9422d8691e1dfb3a46b/.scratch/multi-topic/issues/09-migrate-existing-hindi.md) on 2026-07-10. Relative links in the text resolve against that file's location.

# 09 — Migrate the existing Hindi Topic onto the new model

Status: partial — migration tooling shipped (56682dc); remaining: remove Handbook.pdf from git after confirming the Convex Resource reads back, and confirm the prod run happened

Spec: [`../PRD.md`](../PRD.md). Decision:
[ADR 0009](../../../docs/adr/0009-content-source-of-truth-in-convex-routine-pulls-context.md).

## Want

Carry the live Hindi content + the learner's capture history onto the
multi-tenant model without resetting anything.

## Acceptance

- A `hindi` Topic exists owned by Jonathan, `status: "active"`, with the existing
  Mission text in `topics.mission`.
- `Handbook.pdf` is moved into Convex file storage as a Resource of the `hindi`
  Topic (raw); the 35 MB blob is **removed from `git`** once verified.
- Existing `lessons/` + `references/` remain published and readable under `hindi`.
- Existing `responses`/`progress`/`questions` are backfilled with the `hindi`
  `topicId` (the narrow step of **03**).
- After migration, the reader with one Topic behaves exactly as before.

## Depends on

- **02**, **03** (capture backfill), **04** (Resource for the PDF).

## Notes

- Do this **last**, behind the schema work; it's the cut-over. Keep a Convex prod
  snapshot before the `git` blob removal (the lesson-5 drift incident is the
  cautionary tale — see [docs/routine.md](../../../docs/routine.md) §6).

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding: `Handbook.pdf` is still tracked in git (`git ls-files`). Remaining: confirm the Convex Resource reads back and the prod migration ran, then remove the PDF from the repo.
