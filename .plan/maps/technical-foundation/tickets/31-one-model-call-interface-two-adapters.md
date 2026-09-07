---
type: task
blocked_by: []
---
# One model-call interface, two adapters

## Question

Filed 2026-09-07 from the 2026-09-04 architecture review (candidate 7), re-verified in
the tree on 2026-09-07.

The two model clients have **different interfaces for the same job**:

- `openrouterClient.ts:46` `chatComplete` returns `{ content, usage }` (`:51`).
- `geminiClient.ts:38` `geminiComplete` returns a bare `string`.

Because there is no shared seam, one policy is written twice: the reasoning-opt-out
retry, the missing-key error, the non-OK error, the empty-content error and the env-model
default all appear in both files (`openrouterClient.ts:66-76` against
`geminiClient.ts:61-72`, whose comment at `:65` says it "mirrors openrouterClient"). The
tests mirror the duplication too: `openrouterClient.test.ts:48-89` against
`geminiClient.test.ts:60-97`.

The cost is not only duplication. **The Gemini adapter logs its usage and drops it**
(`geminiClient.ts:81-82`), so the translate path structurally cannot record the token
spend the authoring path already records. `translate.ts:916-920` says exactly that in a
comment: "usage is reported but not recorded". That leaves
[12](12-cost-instrumentation.md)'s `generationRuns` measurement blind on an entire rail.

## Question this must answer, not assume

Whether the shared policy is genuinely identical or only nearly so. Two vendors that
differ on retry semantics behind one interface is worse than two honest copies. Read both
before hoisting, and if a difference is real, say so and keep it in the adapter.

## Done when

One `complete()` returning `{ content, usage }`, both vendors behind it as adapters
(OpenRouter keeping `reasoning.effort`, Gemini keeping `thinkingLevel`), the
post-once-retry-once policy and the error and usage normalisation hoisted into the shared
module, and `translateField` reduced to a dispatch that can hand usage upward. The
duplicated tests collapse onto the shared policy, with each adapter keeping only what is
vendor-specific.

Whether translate then actually *writes* the usage it can now see is in scope to decide
and record, but the schema work is [12](12-cost-instrumentation.md)'s: 12 resolved with
`generationRuns` carrying optional `inputTokens`, `outputTokens` and `model`, written as
a set so absent means unknown and never zero. Follow that convention rather than inventing
a second one.

`pnpm typecheck` and `pnpm test` green.

**Tension worth naming, and this resolves it rather than reopening it.** ADR 0014 rejects
bespoke per-vendor SDK integrations, and `geminiClient.ts` is one, added for a documented
cost reason. Keeping both vendors behind one interface honours the ADR. **Deleting the
native Gemini client would contradict the cost finding, not the ADR, so this ticket does
not propose that** and neither should its Answer.

**Check against [19](19-adr-0014-citation-scope.md) before starting.** 19 asks whether
ADR 0014 is cited more narrowly than its scope. If 19 has resolved, its answer governs how
this ticket may lean on 0014; if it has not, do not settle that question here as a side
effect.
