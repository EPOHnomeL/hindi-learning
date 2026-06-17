# Next-lesson Routine: gate in Convex, API-only routine, one routine for all Topics

> **Partially superseded by [ADR 0009](0009-content-source-of-truth-in-convex-routine-pulls-context.md)
> and [ADR 0010](0010-teaching-compute-swappable-adapter.md).** The Convex gate +
> single-flight lock still stand and generalise to many Topics. What changed: the
> Routine no longer reads the repo for content or commits Lessons to `main`
> (0009) — it claims a Topic and materialises its context from Convex — and the
> compute that runs it is now an explicit swappable adapter (0010). The
> "one Routine, Topic fixed in its instructions" stance is replaced by
> "one topic-agnostic Routine that claims its Topic at run time."

The Routine that authors the next Lesson (PRD FR14) is a single cloud Claude Code
routine with **only an API ("Call via API") trigger — no cron on the routine
itself**. The gate ("author the next Lesson iff the Frontier is `completed`") and
a single-flight lock live in **Convex**, not in the agent. Two callers fire the
routine through one shared `fireIfReady` path: a Convex scheduled function (the
daily run) and a reader button (on demand, when the learner completes the
Frontier). Both pass a `topicSlug` in the fire body; the agent advances that one
Topic.

## Context

The teacher is Claude Code in the workspace, so a Routine *must* be a cloud
Claude Code run (a Convex function can't author a real Lesson). The learner's
button can't run Claude Code — it can only drop a signal — so the daily run and
the button are two *triggers* for one Routine, not two mechanisms. The Anthropic
routine UI grants both a cron trigger and an API Fire URL + token on the same
routine; Convex stores that token and POSTs the Fire URL.

## Decision

- **Gate + lock in Convex, routine API-only.** A daily Convex cron and the
  button both call `fireIfReady(topicSlug)`. With a buffer of one, the gate
  collapses to: the highest-seq non-superseded Lesson is `completed`. Putting it
  in Convex gives one typed source of truth, never boots the agent to no-op, and
  lets button and cron share identical code.
- **Single-flight lock, topic-keyed**, with belt-and-suspenders recovery: the
  agent reports done/failed via a guarded mutation in a `finally`, and the lock
  carries `startedAt` so a run stuck "generating" past a timeout (~10 min) is
  treated as stale and re-fireable.
- **Debounce per Frontier.** The lock records the Frontier key it last fired
  for; a run that publishes no new Lesson (caught up / nothing to queue)
  suppresses the button until the Frontier advances — so the still-open gate
  can't drive endless re-fires.
- **One Routine, Topic fixed by its instructions** (v1). The cloud run API has a
  closed request body — custom fields like `topicSlug` are rejected — so Convex
  fires with no body and the routine's prompt teaches the one Topic (`hindi`).
  The gate, lock, and the agent's report are still Topic-keyed, so multi-topic
  (`.scratch/multi-topic`) will add a Routine per Topic (or use a supported input
  field if the API gains one) without reshaping the Convex side.

## Considered options

- **Cron on the routine, agent self-gates** (rejected): simpler wiring, but boots
  a full agent daily just to no-op, and buries the gate in the agent prompt
  instead of typed Convex code.
- **Slug passed in the fire body** (not possible): the run endpoint validates a
  closed body schema and rejects unknown fields, so the Topic can't travel in the
  request — it's fixed by the routine's instructions instead.

## Consequences

- Convex needs the routine's Fire URL + token as deployment env vars
  (`npx convex env set ROUTINE_FIRE_URL …` / `ROUTINE_FIRE_TOKEN …`), and the
  agent reports its outcome through the `PUBLISH_SECRET`-guarded
  `routine.reportGeneration` mutation (`published` | `nothing` | `failed`),
  called in a `finally`. The same `PUBLISH_SECRET` must be set in the routine's
  cloud environment.
- The cloud agent runs from a fresh checkout: the repo must contain everything it
  authors from (incl. `Handbook.pdf`), and each run must commit + push the new
  Lesson file (source of truth, ADR 0002) *and* publish to prod Convex.
- "Delivery" (FR14) is just Convex realtime: the published Lesson appears in the
  reader live; the button shows generating → done/failed/caught-up off the lock.

The operational wiring this decision implies — the claude.ai routine config, its
connectors/permissions, the fire request shape, Vercel/Convex deploy keys, and
known failure modes — is documented as a runbook in [docs/routine.md](../routine.md).
