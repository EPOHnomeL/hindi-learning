# The teaching compute is a swappable adapter: shared claude.ai Routine now, per-owner Agent-SDK worker later

The *thing that runs the teacher* is treated as a swappable adapter behind the
Convex orchestration seam. Phase 1 keeps a single shared **claude.ai Routine** on
the operator's subscription (no per-token bill) serving all whitelisted Topics;
Phase 2 swaps in per-owner **Agent-SDK workers** on operated compute when scale,
cost-attribution, and isolation demand it — without reshaping the Convex side.

## Context

The teacher must be a real Claude Code agent (a Convex function cannot author a
Lesson — it is short-lived, has no filesystem, and cannot run the file-based
teach skill). The two viable compute hosts trade off oppositely:

- **claude.ai Routine** — runs on the operator's Claude subscription (no
  per-token cost), but is one-per-account, UI-provisioned, and repo-bound, i.e.
  structurally single-tenant and serial.
- **Claude Agent SDK on operated compute** — runs agents programmatically per
  job, fans out, isolates per User, but bills per token and needs a container
  with Node and the PDF toolchain that the operator runs and secures.

For a 4-User whitelisted alpha, cost dominates and fan-out does not yet matter;
later, fan-out and per-User cost-attribution dominate.

## Decision

- **Convex stays the orchestration seam** — gate, lock, claim, fire, report (see
  [ADR 0009](0009-content-source-of-truth-in-convex-routine-pulls-context.md)) —
  and *who runs the agent* is an adapter behind it.
- **Phase 1:** one shared claude.ai Routine on the operator's subscription serves
  all whitelisted Topics, throttled by the daily schedule (**fire-all**: one
  fresh run per ready Topic). Per-Topic isolation is enforced by Convex scoping,
  so **no per-User credentials are needed**.
- **Phase 2:** swap the compute for **per-owner Agent-SDK workers** on operated
  compute, billed per job. The claim protocol and the publish/report mutations
  are unchanged — a compute swap, not a rebuild.

## Considered options

- **Agent SDK from day one** (rejected for the alpha): per-token cost with no
  fan-out benefit while there are 4 trusted Users.
- **Direct Claude Messages API with a custom harness** (rejected): reimplements
  the file-based teach skill's loop (ZPD, references, learning records, Resource
  grounding); more code to own for no near-term gain.
- **Keep Routines forever** (rejected): cannot fan out to real Users at scale;
  one serial bottleneck on one subscription.

## Consequences

- Phase 1 accepts a serial-ish bottleneck and a **usage-spike risk** if repeated
  routine fires happen to run in parallel; mitigated by the daily schedule, a
  gated on-demand button, and stale-lock recovery.
- The **undocumented concurrency behavior** of repeated fires must be verified
  empirically (fire two, watch); the atomic-claim + stale-lock design degrades
  gracefully whatever it turns out to be.
- The **operator funds all Phase-1 authoring**; the `AUTH_ALLOWED_EMAILS`
  whitelist bounds that exposure to the 4 known Users.
