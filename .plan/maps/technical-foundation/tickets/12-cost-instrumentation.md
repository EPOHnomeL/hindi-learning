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

## Answer

Built 2026-09-04 (session `cost-instrumentation-2026-09-04`). Measurement only: no price,
no currency, no cap and no threshold was added anywhere. Ticket 13 (exchange rates) keeps
the money question.

### The 2026-07-10 comment, re-verified today

All three claims were still TRUE on 2026-09-04, at moved line numbers (the layout shifted
twice on 2026-09-04 under tickets 16 and 18, and `routine.ts` has grown to 972 lines):

1. `reportGeneration` took no usage or token fields. Its args were `secret`, `topicSlug`,
   `outcome`, `error`, `estimatedLessons` at `convex/routine.ts:426-436`, not `216-236`.
2. `openrouterClient.chatComplete` read only `json.choices[0].message.content` and dropped
   the sibling `usage` object, at `convex/openrouterClient.ts:38-69`, not `34-52`.
3. No cost table and no per-Topic aggregate existed. `generationRuns` (from
   generation-observability) was the nearest thing and its own schema comment reserved the
   gap: "No trigger/provider/token fields (kept lean; the token seam is
   internal-course-studio/03's)", which is this ticket under its pre-2026-09-01 number.
   The existing `usageByDay` counts RUNS per day, never tokens.

Nothing was already built, so nothing was rebuilt. The stale schema comment naming the old
ticket number was corrected in the same commit that filled the gap.

### What was built

- `convex/schema.ts`: `generationRuns` gains optional `inputTokens`, `outputTokens`,
  `model`. Optional fields on an existing table, so no widen-migrate-narrow deploy and no
  backfill: every live row stays valid and reads as unmeasured.
- `convex/routine.ts`: `reportGeneration` gains an optional `usage` arg
  (`{inputTokens, outputTokens, model}`), passed through the existing single `recordRun`
  write site. The run row is still insert-once and still written at every terminal exit.
- `convex/openrouterClient.ts`: `chatComplete` now returns `{content, usage}` instead of a
  bare string, parsing `usage.prompt_tokens` / `usage.completion_tokens`.
- `convex/openrouter.ts`: `authorTopic` sums usage across a run's model calls (a bootstrap
  run makes two) and reports the total, including on the failure path, since a run that
  died still spent tokens.
- `convex/routine.ts`: `tokenUsageByTopic`, a sys-admin-gated query summing each Topic's
  runs over the most recent 1000 runs.
- `src/app/_components/AdminPanel.tsx`: a plain list on the Generation tab, under the run
  history.

The operator gate is `isCallerAdmin` (`convex/whitelist.ts`), matching `runHistory` and
`usageByDay` beside it, not `assertAdmin`. `assertAdmin` (which did move to
`convex/adminSecret.ts` under ticket 16) is the PUBLISH_SECRET check for machine callers,
and it does guard the write half of this, `reportGeneration`. Two different gates for two
different callers: a signed-in human reads the aggregate, a secret-bearing agent writes the
run.

### Unknown is not zero

The three fields are optional and written as a SET, never partially. A run that could not
count itself omits `usage` entirely, so absent means unknown and `0` would mean a genuine
zero. Nothing defaults, coalesces or `?? 0`s them into the sums. The aggregate therefore
returns no single "total cost" number: it returns `runs`, `runsWithoutUsage` and the sums
of the measured runs only, so a Topic reading `runs: 12, runsWithoutUsage: 12` is visibly
unmeasured rather than free. Read any sum as a floor. The admin panel prints "n of m runs
not measured" for exactly this reason.

### Which seam reports real numbers, and which cannot

- **OpenRouter (in-Convex `authorTopic`, courses with `provider: "openrouter"`): real
  numbers.** The provider returns a `usage` object per call and the client now keeps it.
- **The cloud claude.ai Routine: no numbers, today or ever on this path.** Its report seam
  is the `scripts/report.ts` CLI, invoked by the run itself with an outcome, a slug, an
  optional error and an optional estimate. Claude Code on the operator's subscription does
  not hand its own token totals to a shell it spawns, so there is nothing true to pass. A
  `--tokens` flag was deliberately NOT added: it could only carry a hand-typed guess, and a
  guess in this column is worse than an honest blank. Every Claude run therefore lands in
  `runsWithoutUsage`, which is currently most runs in production.

Translation is out of scope and untouched as a unit of cost: `translate.ts` reads
`.content` off the new return shape and records nothing, since a translation job is not a
Routine run and has its own `translationJobs` rows.

### Left for ADR 0014's runtime, deliberately

The programmatic provider-agnostic runtime is not pulled forward. When it lands it fills
this in by passing `usage` to the same `reportGeneration` arg the OpenRouter path already
uses: no schema change, no new table, no aggregate change, and `runsWithoutUsage` falls on
its own as real rows arrive. Also left alone: cost per Lesson or per learner, any currency
conversion (ticket 13), retention or rollup of old run rows, and a global total across
Topics.

### Evidence

Verified by reading the code and by a green suite, NOT walked in a browser. `pnpm typecheck`
clean and `pnpm vitest run` green after every commit: 87 files, 1045 tests, up from the
86 files / 1037 tests baseline taken at the start of this session. Eight new tests, in
`convex/generation-cost.test.ts` (a completed run persists usage against the right Topic; a
run with no counts leaves the fields absent; the aggregate sums multiple runs and counts the
unmeasured one; the aggregate is Admin-only), `convex/openrouter.test.ts` (an end-to-end
`authorTopic` run lands the provider's counts on the run row, and lands nothing when the
provider reports none) and `convex/openrouterClient.test.ts` (usage parsed; absent usage is
undefined).

**Outstanding for the operator: the Tokens list on the admin Generation tab has never been
looked at in a browser.** It typechecks and its query is tested, but no human has seen it
render.

<!-- Migrated 2026-07-30 from GitHub issue #75 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
<!-- Some links in this ticket were de-linked in the 2026-07-30 migration: their targets
     (.scratch PRDs, already-resolved sibling tickets, the retired product-direction
     roadmap) do not exist in the repo. The names are kept as prose for provenance. -->

<!-- Moved 2026-09-01 from `internal-course-studio/03` into the technical-foundation map, which groups this repo’s scalability, refactoring and code-architecture work. Renumbered to 12 because `blocked_by` is map-local and the old numbers collided. Inbound links across `.plan/` were repointed in the same commit. -->
