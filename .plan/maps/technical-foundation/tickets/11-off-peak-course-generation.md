---
type: grilling
blocked_by: [12]
---

# Off-peak scheduling for course generation (on-demand admin finisher shipped)

## Question

**Where it stands (corrected 2026-08-18):** the on-demand half is **built and live**; only the
*scheduled, off-peak* half is open, and whether it is still wanted is the open question. The
"not built" line below was already wrong when this ticket was migrated — see the 2026-07-10
comment, which the migration carried in without reconciling the header against it.

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
- Cost controls (roadmap Costing; a deleted GitHub issue 08, see the migration note below). **Now a real edge:** [12, cost instrumentation](12-cost-instrumentation.md) blocks this ticket, because the buffer-of-one gate exists as a cost throttle and removing it cannot be priced without per-run token numbers.

## Notes

- This intentionally **inverts** the buffer-of-one throttle, which is exactly why it's admin-gated and cost-bounded.
- To-scope only; not built. **(Stale — corrected 2026-08-18: the on-demand finisher is built. Only the off-peak scheduling is open.)**

## Comments

### EPOHnomeL — 2026-07-10

**Verified 2026-07-10 (main @ 1b2db94) — the substance shipped since the 2026-07-08 audit; retitled to the remaining scope.**

Already shipped as the admin fire-and-pray course finisher (fa38e45, 92e353b, 8015a8b, 1b2db94): admin-only (`callerIsAdmin`, routine.ts:432-436), bypasses the buffer-of-one Frontier gate (routine.ts:454-484), 30-lesson per-run cap (routine.ts:422), idempotent with cancel + watchdog, triggered from the dashboard ⋯ menu.

**Actual remaining scope:** the scheduled/off-peak delivery — convex/crons.ts still has only the gated `dailyFire` cron; nothing triggers `finishGenerating` overnight. Decide whether that half is still wanted now that the on-demand version exists.

## Done when

**Superseded 2026-08-18 — the original condition was already met.** It read: *"An Admin can mark
a Topic for off-peak full generation with a per-run Lesson cap; ordinary owners cannot; the
Frontier bypass is admin-gated and tested."* Everything in that sentence except the words *off-peak*
ships today, re-verified on `main` @ `bf04257`: `finishGenerating` (`convex/routine.ts:782`) is
admin-gated via `callerIsAdmin` (`routine.ts:650`), bypasses the buffer-of-one Frontier gate, and
carries a per-run Lesson cap.

The condition that actually remains: **a decision on whether the scheduled half is still wanted**
now that the on-demand finisher exists — and if it is, an off-peak trigger for `finishGenerating`.
`convex/crons.ts` still registers exactly one job, the gated `dailyFire` at 04:23 UTC; nothing
schedules the finisher. Ruling the scheduled half out of scope is a legitimate outcome here.

<!-- Migrated 2026-07-30 from GitHub issue #100 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
<!-- Some links in this ticket were de-linked in the 2026-07-30 migration: their targets
     (.scratch PRDs, already-resolved sibling tickets, the retired product-direction
     roadmap) do not exist in the repo. The names are kept as prose for provenance. -->

---

## Context folded from the retired `scheduled-authoring` map (2026-08-01)

<!-- was .plan/maps/course-authoring/tickets/05-off-peak-course-generation.md; that single-ticket map was consolidated into course-authoring -->

- **Today's behaviour is a deliberate cost throttle, not a limitation.** Both the daily
  `dailyFire` cron (04:23 UTC) and the on-demand reader button author only the **next** Lesson,
  and only once the learner has completed the Frontier. A course is built incrementally as the
  learner advances, which bounds Claude usage.
- **So this ticket is asking to remove a safety mechanism.** That is why it is Admin-only
  (ADR 0011 allowlist) and why a **per-run Lesson cap** is not optional — without it a single
  overnight run can spike usage without bound.
- The on-demand admin finisher already shipped; what remains is the *scheduled, off-peak*
  half. Verify what exists before building.
- Completion is the natural stopping condition: loop until the Mission's "success looks like"
  outcomes are met.
- Relates to ADR 0001 (async hub-mediated loop), ADR 0008 (the next-lesson gate),
  `convex/crons.ts`.
- **Pairs with**
  [Cost instrumentation](12-cost-instrumentation.md):
  running unattended overnight is precisely when you want per-run token numbers, and
  [Streamline the Routine's effort](../../course-authoring/tickets/04-streamline-routine-effort.md) makes each run cheaper
  before you multiply it by a whole curriculum. Consider doing both first.
- Skills: `/grilling`, `convex:convex-crons`, `convex:convex-expert`.
- **Fog:** what happens when an overnight run fails halfway. Unattended work needs a failure
  story a human reads in the morning; not yet sharp enough to ticket.
- **Out of scope:** opening this to ordinary owners — the whole point is that it is admin-gated.

<!-- Moved 2026-09-01 from `course-authoring/05` into the technical-foundation map, which groups this repo’s scalability, refactoring and code-architecture work. Renumbered to 11 because `blocked_by` is map-local and the old numbers collided. Inbound links across `.plan/` were repointed in the same commit. -->
