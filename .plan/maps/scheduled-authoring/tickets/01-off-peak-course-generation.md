---
type: grilling
blocked_by: []
---

# Off-peak scheduling for course generation (on-demand admin finisher shipped)

## Question

**Where it stands:** needs-triage (to-scope — captured 2026-07-08; not built)

Vocabulary: [`CONTEXT.md`](../../../../CONTEXT.md) (Routine, Frontier, Topic, Completion, Mission, Admin). Relates to [ADR 0001](../../../../docs/adr/0001-asynchronous-hub-mediated-teaching-loop.md) (async hub-mediated loop), [ADR 0008](../../../../docs/adr/0008-next-lesson-routine-gate-in-convex.md) (next-lesson Routine gate — daily cron + on-demand button), [`convex/crons.ts`](../../../../convex/crons.ts) (the daily `dailyFire` cron at 04:23 UTC), [`convex/routine.ts`](../../../../convex/routine.ts), and the roadmap Costing section.

## Want

An **admin-only** mode where a Topic is **fully auto-generated overnight** — the Routine authors the *entire* curriculum unattended during off-peak (midnight) hours — instead of one Lesson at a time gated by learner progress.

## Current behaviour (for contrast)

The Routine authors a **buffer of one**: both the daily `dailyFire` cron (04:23 UTC) and the on-demand reader button author only the **next** Lesson, and only once the learner has completed the **Frontier** ([`convex/routine.ts`](../../../../convex/routine.ts)). A course is therefore built incrementally, lesson-by-lesson, as the learner advances — a deliberate cost throttle (multi-topic issue 08, "bounds Claude usage").

## Acceptance (to refine at triage)

- An **Admin** can mark a Topic for **full overnight generation**: the Routine loops and authors Lessons until the Mission's "success looks like" outcomes are met (**Completion**), **bypassing** the Frontier buffer-of-one gate.
- Runs in **off-peak / midnight hours** (a new or segmented cron) to avoid daytime load and usage spikes.
- **Admin-only.** Because it removes the buffer-of-one cost throttle, it must **not** be available to ordinary owners — gate on the **Admin** capability ([ADR 0011](../../../../docs/adr/0011-allowlist-in-convex-admin-portal.md)).
- **Cost + rate guardrails**: a per-run Lesson cap so a single overnight run cannot spike Claude usage without bound (roadmap Costing).
- **Idempotent** and safe to re-run; respects **Completion** (stops when the course is done) and the Routine's existing lock (no double-authoring).

## Depends on

- The Routine gate/lock ([ADR 0008](../../../../docs/adr/0008-next-lesson-routine-gate-in-convex.md)).
- The **Admin** capability ([ADR 0011](../../../../docs/adr/0011-allowlist-in-convex-admin-portal.md)).
- Cost controls (roadmap Costing; multi-topic issue 08).

## Notes

- This intentionally **inverts** the buffer-of-one throttle, which is exactly why it's admin-gated and cost-bounded.
- To-scope only; not built.

## Comments

### EPOHnomeL — 2026-07-10

**Verified 2026-07-10 (main @ 1b2db94) — the substance shipped since the 2026-07-08 audit; retitled to the remaining scope.**

Already shipped as the admin fire-and-pray course finisher (fa38e45, 92e353b, 8015a8b, 1b2db94): admin-only (`callerIsAdmin`, routine.ts:432-436), bypasses the buffer-of-one Frontier gate (routine.ts:454-484), 30-lesson per-run cap (routine.ts:422), idempotent with cancel + watchdog, triggered from the dashboard ⋯ menu.

**Actual remaining scope:** the scheduled/off-peak delivery — convex/crons.ts still has only the gated `dailyFire` cron; nothing triggers `finishGenerating` overnight. Decide whether that half is still wanted now that the on-demand version exists.

## Done when

An Admin can mark a Topic for off-peak full generation with a per-run Lesson cap; ordinary owners cannot; the Frontier bypass is admin-gated and tested.

<!-- Migrated 2026-07-30 from GitHub issue #100 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
<!-- Some links in this ticket were de-linked in the 2026-07-30 migration: their targets
     (.scratch PRDs, already-resolved sibling tickets, the retired product-direction
     roadmap) do not exist in the repo. The names are kept as prose for provenance. -->
