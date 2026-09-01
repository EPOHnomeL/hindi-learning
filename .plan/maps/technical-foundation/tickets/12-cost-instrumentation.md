---
type: task
blocked_by: []
---

# Cost instrumentation (tokens per Routine run)

## Question

**Where it stands:** open — no token/usage recording or per-Topic aggregate

Vocabulary: [`CONTEXT.md`](../../../../CONTEXT.md) (Routine, Topic, Generation). Spec: `../../internal-course-studio/PRD.md`. Respects [ADR 0008](../../../../docs/adr/0008-next-lesson-routine-gate-in-convex.md) / [ADR 0009](../../../../docs/adr/0009-content-source-of-truth-in-convex-routine-pulls-context.md) (the gate + report path).

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

- The current teaching compute is the shared **claude.ai Routine** (Claude Code on the operator's subscription), which may not surface exact token counts to the report path. Record whatever the run can report; if exact counts are unavailable, capture the gap explicitly. Full-fidelity per-run accounting arrives with the programmatic, provider-agnostic runtime ([ADR 0014](../../../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md)) — do **not** pull that work forward here. Build the seam so it fills in cleanly when the runtime lands.

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding as written: `reportGeneration` takes no usage/token fields (routine.ts:216-236), the OpenRouter client discards the `usage` object it gets back (openrouterClient.ts:34-52), and there is no cost table or per-Topic aggregate anywhere in the schema.

## Done when

Per-run token usage is persisted against the Topic and a per-Topic aggregate is exposed to the operator only, with tests — and no metering or billing logic is introduced.

<!-- Migrated 2026-07-30 from GitHub issue #75 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
<!-- Some links in this ticket were de-linked in the 2026-07-30 migration: their targets
     (.scratch PRDs, already-resolved sibling tickets, the retired product-direction
     roadmap) do not exist in the repo. The names are kept as prose for provenance. -->

<!-- Moved 2026-09-01 from `internal-course-studio/03` into the technical-foundation map, which groups this repo’s scalability, refactoring and code-architecture work. Renumbered to 12 because `blocked_by` is map-local and the old numbers collided. Inbound links across `.plan/` were repointed in the same commit. -->
