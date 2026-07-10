# 03 — Cost instrumentation (tokens per Routine run)

Status: open — no token/usage recording or per-Topic aggregate

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Routine, Topic, Generation). Spec: [`../PRD.md`](../PRD.md). Respects [ADR 0008](../../../docs/adr/0008-next-lesson-routine-gate-in-convex.md) / [ADR 0009](../../../docs/adr/0009-content-source-of-truth-in-convex-routine-pulls-context.md) (the gate + report path).

## What to build

Record **token usage per Routine run** on the existing report path, and expose a **per-Topic usage aggregate** to the operator. Measurement only — no billing, no metering enforcement. This converts the roadmap's costing *formula* into a real per-course number.

## Acceptance criteria

- [ ] The Routine report path persists per-run usage (input tokens, output tokens, model) associated with the Topic and run.
- [ ] A per-Topic aggregate query sums usage across that Topic's runs.
- [ ] The aggregate is surfaced minimally to the operator only (operator view/field) — never to end users.
- [ ] No metering enforcement or billing logic is introduced.
- [ ] Tests: a completed run persists a usage record tied to the correct Topic; the aggregate sums multiple runs.

## Blocked by

None - can start immediately.

## Notes

- The current teaching compute is the shared **claude.ai Routine** (Claude Code on the operator's subscription), which may not surface exact token counts to the report path. Record whatever the run can report; if exact counts are unavailable, capture the gap explicitly. Full-fidelity per-run accounting arrives with the programmatic, provider-agnostic runtime ([ADR 0014](../../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md)) — do **not** pull that work forward here. Build the seam so it fills in cleanly when the runtime lands.

## Comments

- 2026-07-10 — Migrated to GitHub issue [#25](https://github.com/EPOHnomeL/hindi-learning/issues/25); GitHub is now the tracking home for this ticket.
