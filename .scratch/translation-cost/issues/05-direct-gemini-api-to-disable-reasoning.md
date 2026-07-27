# translation-cost/05: Direct Gemini (AI Studio) seam to actually disable reasoning

**Status:** done (2026-07-21) — shipped the direct-Gemini seam; **corrected same day**
(the `thinkingBudget: 0` opt-out doesn't disable thinking on Gemini 3.x — now `thinkingLevel: "minimal"`).
**Labels:** ready-for-human (smoke + $ measurement per issue 04 §Protocol)
**Depends on:** informs / competes with
[04-test-translation-models.md](04-test-translation-models.md) — pick whichever
is cheaper for acceptable fidelity.

## Outcome

- New **[`convex/geminiClient.ts`](../../../convex/geminiClient.ts)** — native
  Google AI Studio `:generateContent`, `GOOGLE_AI_API_KEY`,
  `thinkingConfig.thinkingLevel: "minimal"` (retries once without the control if a
  model rejects it). Mirrors `openrouterClient`'s dependency-free `fetch` seam.
  Also logs `usageMetadata.thoughtsTokenCount` per call so real reasoning spend is
  visible in `npx convex logs`.

## Correction (2026-07-21) — `thinkingBudget: 0` is not an off switch on 3.x

The original ship sent the **Gemini 2.5-era** `thinkingConfig.thinkingBudget: 0`.
On **Gemini 3.x** (the default `gemini-3.5-flash`) that knob is deprecated and does
**not** disable thinking: the 3.x thinking control is the categorical
`thinkingLevel` enum (`minimal | low | medium | high`), and there is **no "off"** —
`"minimal"` is the floor and still bills some thought tokens. So the seam never ran
reasoning-free; the observed cost drop (~R90 → R70) was OpenRouter's markup coming
off as we moved to native pricing, not thinking going away. Fix: send
`thinkingLevel: "minimal"` and log `thoughtsTokenCount` to make the real number
observable. If genuine zero-reasoning is wanted, that needs a model that supports it
(e.g. `gemini-2.5-flash-lite` via `GEMINI_TRANSLATE_MODEL`) — see issue 04.
Refs: [Gemini thinking docs](https://ai.google.dev/gemini-api/docs/thinking),
[What's new in 3.5 Flash](https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.5).
- **[`convex/translate.ts`](../../../convex/translate.ts)** `translateField` now
  routes by `TRANSLATE_PROVIDER` (`gemini` default | `openrouter` rollback);
  authoring untouched (still OpenRouter/GLM).
- Env: `GOOGLE_AI_API_KEY` (+ optional `GEMINI_TRANSLATE_MODEL`, default
  `gemini-3.5-flash`). `TRANSLATE_PROVIDER` selects the path. See Correction below —
  `minimal` is not `off` on 3.x.
- Tests: `geminiClient.test.ts` (wire format + thinking-off + retry) and
  `translate-gemini.test.ts` (default-path end-to-end); the OpenRouter suite is
  pinned to `TRANSLATE_PROVIDER=openrouter`.
- **Still open (needs-human):** set `GOOGLE_AI_API_KEY --prod`, run the issue-04
  Test-Course smoke + one full-course $ measurement, record it in the PRD.

Child of [.scratch/translation-cost/PRD.md](../PRD.md).

## Why

`reasoning: { effort: "none" }` (translation-cost 02) is **not honored** for
`google/gemini-3.5-flash` on OpenRouter: the endpoint 400s the opt-out and
[`chatComplete`](../../../convex/openrouterClient.ts) silently retries with
reasoning **on** ([openrouterClient.ts:57-62](../../../convex/openrouterClient.ts#L57-L62)).
So every 3.5-Flash translation call still bills thinking tokens as output — the
suspected main driver of the "sooo expensive" per-course cost, on top of the
frontier base rate (issue 04).

Google's **native** Gemini API (AI Studio key) exposes `thinkingConfig`, which
OpenRouter's unified toggle doesn't reach. **[Corrected]** the original plan assumed
`thinkingBudget: 0` turns thinking off on the Flash tiers — true for **2.5**, but on
**3.x** that knob is deprecated and thinking can only be pushed to `thinkingLevel:
"minimal"`, never off (see Correction above). So the direct-Gemini path *minimises*
reasoning on 3.5-flash; paying nothing for reasoning needs a 2.5-lite model swap.

## Open questions (spike first — don't build yet)

- **Is it even needed?** If issue 04 finds a cheap OpenRouter model that's
  non-thinking by default (`gemini-*-flash-lite`, `deepseek-*`) and passes the
  fidelity bar, that's cheaper *and* zero new code. Run 04 first; only build
  this if a Gemini Flash tier specifically wins on quality and the reasoning
  bill is what's killing it.
- **Confirm `thinkingBudget: 0` is accepted** on the target model via AI Studio
  (some tiers clamp a minimum budget). Verify against current Google docs.
- **Cost math:** native AI Studio per-token price with thinking off vs. the
  cheapest acceptable OpenRouter candidate from 04.

## Shape (if the spike says go)

- Add a **direct-Gemini client** as a sibling of `convex/openrouterClient.ts`
  (same dependency-free `fetch` seam, same test boundary via
  `vi.stubGlobal("fetch", ...)`) — Google `:generateContent`, `GEMINI_API_KEY`,
  `thinkingConfig.thinkingBudget: 0`.
- Route **only** `translateField` through it (authoring stays on OpenRouter/GLM).
  Pick the provider by env so it's a per-deployment switch, not a hard fork —
  e.g. `TRANSLATE_PROVIDER=gemini|openrouter`.
- New env: `GEMINI_API_KEY` (+ optional `GEMINI_TRANSLATE_MODEL`).
- Reuse the existing measurement protocol (issue 04 §Protocol) to record the
  real per-course $ and `failed` count against the current baseline.

## Constraints

- Same fidelity bar as issue 04: placeholders (`<!--⟦N⟧-->`) and quiz
  attributes must survive verbatim; `failed > 0` is the disqualifier.
- Keep the app LLM-free stance intact — this is still an operator key on the
  Convex deployment, no per-user keys (ADR 0014).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
