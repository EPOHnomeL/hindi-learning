# Content source of truth moves to Convex; the Routine pulls per-Topic context (supersedes 0002; partially supersedes 0008)

For the multi-tenant topic dashboard, the durable source of truth for all
content moves from the local git workspace into **Convex**, and the cloud
**Routine** stops reading the repo for content (or committing Lessons back to
`main`) — instead it **claims** one ready Topic at run time and materialises
that Topic's context from Convex. The repo now holds only code and the teach
skill. This supersedes [ADR 0002](0002-local-workspace-source-of-truth-neon-mirror-via-mcp.md)
and the "repo is the authoring context / commit Lessons to `main`" parts of
[ADR 0008](0008-next-lesson-routine-gate-in-convex.md).

## Context

The original model (0002, 0008) made the **local repo the source of truth**: the
cloud Routine cloned the repo, read files (including the 35 MB `Handbook.pdf`),
authored, committed the new Lesson back to `main`, and published to Convex. That
is structurally **single-tenant** — one repo, one Routine, one Topic fixed in the
Routine's instructions.

The new requirement (see [CONTEXT.md](../../CONTEXT.md): Topic, Seed, Resource,
Mission) is a multi-tenant dashboard where ~4 whitelisted Users start their own
**Topics**, upload **Resources**, and switch between them, while one shared cloud
Routine on the operator's subscription authors for all of them. N Users' Topics
and Resources cannot live in one git repo, and the Routine cannot carry each
Topic in its instructions or receive it in the (closed) fire body.

## Decision

- **Convex is the source of truth for all content**: Topics (owner, Mission,
  Seed, lifecycle `seeded → active`), Lessons, References, **Resources** (raw
  blob in Convex **file storage** plus lazily-rendered processed artifacts cached
  back and keyed by `contentHash`), and capture (now Topic-scoped). The repo
  holds only code and the teach skill.
- **The Routine pulls, never reads the repo for content.** On each run it
  **claims** one ready Topic from Convex, materialises that Topic's bundle
  (Mission, raw + processed Resources, prior Lessons, learning records, the
  Topic-scoped capture state) into an ephemeral `topics/<slug>/` workspace, runs
  the **unchanged** file-based teach skill, **publishes** results back to Convex,
  and **reports** (releasing the lock). No `git` commit of Lessons.
- **Topics are claimed at run time.** The gate locks one ready Topic before
  firing; the run claims the locked Topic atomically (`claimedAt`/`runId`). A
  single topic-agnostic Routine therefore serves every Topic with no per-Topic
  instructions and no fire-body field.

## Considered options

- **Keep the repo as source of truth, write User Topics into it from the web**
  (rejected): can't commit N Users' PDFs, forces the web to write to `git`,
  bloats the repo with binaries, and still needs per-Topic Routine instructions.
- **Pre-process Resources at upload into a separate store** (rejected for now):
  needs a second compute at upload time; we chose the hybrid lazy-cache in Convex
  file storage instead (raw kept, processed cached on first need).

## Consequences

- The file-based teach skill is **preserved unchanged** — the rationale of 0002
  (the skill is deeply file-oriented) still holds; only the *durable* source of
  truth moved. The workspace is now a transient working copy, not the SoT.
- **Offline authoring and a `git` history of Lessons are given up.** Conversely,
  the 0002/0008 drift failure mode (publish succeeds, commit is stranded) is
  gone: `git` no longer carries content, so there is nothing to reconcile.
- **`Handbook.pdf` and the existing Hindi Lessons migrate out of `git`** into
  Convex (a one-time data migration), shrinking the repo.
- **Capture must carry `topicId`** and be scoped by owner + Topic; existing rows
  backfill to the `hindi` Topic (widen → backfill → narrow). Without this, two
  Topics' `0001-` Lessons collide.
- The gate gains a **bootstrap path** (fire a seeded Topic that has no Lessons
  yet), and firing generalises to many Topics (lock-per-Topic, atomic claim,
  stale-lock recovery).
