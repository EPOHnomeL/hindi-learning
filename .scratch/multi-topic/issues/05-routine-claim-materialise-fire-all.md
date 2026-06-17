# 05 — Routine: claim, materialise from Convex, fire-all (drop git-commit)

Status: ready-for-agent

Spec: [`../PRD.md`](../PRD.md). Decisions:
[ADR 0009](../../../docs/adr/0009-content-source-of-truth-in-convex-routine-pulls-context.md),
[ADR 0010](../../../docs/adr/0010-teaching-compute-swappable-adapter.md).

## Want

Make the single Routine topic-agnostic: claim one ready Topic at run time,
materialise its context from Convex into an ephemeral workspace, author there,
publish back, report — with no `git` commit of content.

## Acceptance

- `generation` gains `claimedAt` / `runId`. A new `routine.claimWork` mutation
  atomically returns one locked-but-unclaimed Topic and marks it claimed
  ([routine.ts](../../../convex/routine.ts)).
- New CLI/agent step `materialise --topic <slug>`: pulls Mission, Resources
  (raw + any cached processed), prior Lessons, learning records, and
  Topic-scoped capture into `topics/<slug>/`; the teach skill runs against that
  dir, not the repo root.
- `publish`/`review`/`reply`/`report` take `--topic <slug>` and are owner+Topic
  scoped ([publish.ts](../../../scripts/publish.ts), `review.ts`, `reply.ts`,
  `report.ts`); `ensureTopic` is no longer hardcoded to `"Hindi"`.
- `dailyFire` fires **all** ready Topics across all users (lock each, fire once
  per lock); stale locks re-fire next cron.
- The Routine **no longer commits Lessons to `main`**; Convex is the source of
  truth. The claude.ai Routine instructions are rewritten to: claim →
  materialise → review/reply → author → publish → report.

## Depends on

- **02** (scoping), **03** (capture scope), **04** (Resources to materialise).

## Notes

- Verify empirically how repeated fires behave (parallel / queued / dropped) and
  record it; the claim + stale-lock design tolerates any of them (ADR 0010).
- Keep the on-demand button path working but gated (**08**).
