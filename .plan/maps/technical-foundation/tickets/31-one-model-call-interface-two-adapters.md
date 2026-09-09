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

## Answer

2026-09-08, built. `convex/modelCall.ts` is the shared policy and each client is reduced
to its wire format.

**The question this ticket said to answer rather than assume: the policy IS genuinely
identical.** Read side by side, both clients require a key, build the request, post, and on
a 400 whose body complains about the reasoning control drop that control and post once
more; then refuse a non-OK response, refuse an empty completion, normalise the usage. Every
difference is wire format, and each now lives in its adapter with a name: the endpoint and
headers, which control gets dropped (`reasoning.effort` against `thinkingLevel`), what a
reasoning complaint looks like in that vendor's prose, and where content and token counts
sit in the response.

**One behavioural difference was real, and is now explicit rather than incidental.**
OpenRouter only sends the control when a caller asks for it, so a 400 with nothing to drop
must not be retried; the Gemini client always sends it. `sendsReasoningControl` is that
difference, and a test drives the branch.

`geminiComplete` returns `{ content, usage }` like its sibling, so the translate rail can
now see its token spend instead of logging and dropping it, and Gemini's thought tokens are
counted as output because that is how they are billed. Both rails log usage identically,
unknown reported as unknown rather than zero.

**Decided and recorded, as the ticket asked:** translation usage is NOT persisted. Ticket
12 instruments Routine runs in `generationRuns`, per Topic; a translation job is a
different unit with its own `translationJobs` row and no usage columns, so recording it is
schema work on that table and its own ticket.

ADR 0014 is honoured, not reopened, and 19 has not resolved, so nothing here settles how
narrowly 0014 may be cited.

Verified by test. `pnpm typecheck` and the full suite green.
