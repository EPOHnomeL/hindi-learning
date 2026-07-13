# PRD: Translation cost — strip boilerplate + no thinking

Status: ready — grilled and agreed (2026-07-13).

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — **Topic**, **Edition**,
> **Lesson**, **Reference**. Builds on the OpenRouter translate path
> (`convex/translate.ts` `translateTopic`, `convex/openrouterClient.ts`) shipped
> in [openrouter-provider](../openrouter-provider/PRD.md) and made
> resumable/chunked in `fff7cfa`.

## Problem Statement

Translating the 56-lesson "Growing your relationship with the Holy Spirit"
course to Afrikaans cost **$6.82 / 1.26M tokens / 118 requests** on
`google/gemini-3.5-flash`. Two structural wastes drive that:

1. **~70% of every Lesson body is fixed boilerplate.** Lesson blobs are full
   HTML documents; the shared head partial is ~11.2KB and the foot scripts
   ~3KB against ~17–21KB total. That CSS/JS is sent to Gemini *and* echoed
   back verbatim in the output — and output tokens are the expensive ones.
2. **Default thinking.** `chatComplete` sends no `reasoning` config, so Gemini
   spends its default thinking budget on every call — billed as output tokens,
   worthless for constrained HTML translation.

Goal (grilled): **as cheap as possible without hurting fidelity** — expected
landing zone ~$1–2 per course of this size.

## Solution

1. **Placeholder-swap static blocks.** Before translating a Lesson/Reference
   body, replace every `<style>…</style>` and `<script>…</script>` element with
   a short numbered placeholder comment; translate; substitute the originals
   back. Verify each placeholder returns **exactly once** (and none invented);
   any mismatch → the item is *not published* (English fallback, counted
   `failed` at report), never a corrupted lesson. Side benefit: the model can
   no longer mangle the quiz scripts at all.
2. **Reasoning off for translation calls only.** `chatComplete` gains an
   opt-out used by `translateField`; the authoring path (GLM 4.7) keeps its
   defaults. Test the output quality on a real run; reconsider if it dips.
3. **Model unchanged.** `google/gemini-3.5-flash` stays the default;
   `OPENROUTER_TRANSLATE_MODEL` already allows keyless-deploy experimentation.
   Revisit only after measuring 1+2.
4. **Quiz-marker check moves into reach.** The mutation-side quiz guard is
   skipped for blob-backed sources (mutations can't read blobs), but the
   *action* holds both source and translated markup — check
   `quizStructureMatches` there and skip the item on drift.

## Measurement protocol (grilled)

After deploy: translate the small **Test Course** into a new language
(~cents) to smoke-test reassembly end-to-end, then translate the Growing
course into one more genuinely wanted language — that run is the real $
measurement, read off the OpenRouter dashboard. Record the numbers in this
PRD. Only then reconsider thinking/model.

## Implementation Decisions

- **Pure swap helpers in `translate.ts`** (exported for tests):
  - `swapOutStatic(html)` → `{ stripped, blocks: string[] }` — extracts each
    `<style>…</style>` / `<script>…</script>` element (tag + attributes +
    content) in document order, replacing it with `<!--⟦N⟧-->`-style numbered
    placeholder comments.
  - `swapBackStatic(translated, blocks)` → `string | null` — substitutes each
    block back; returns `null` unless every placeholder occurs exactly once
    and no unknown placeholders appear.
- **Wire into the action only.** `translateTopic`'s lesson/reference branch
  strips before `translateField(..., "html")` and reassembles after. A `null`
  reassembly or a `quizStructureMatches(source, reassembled)` failure skips
  the publish for that item (existing failed-at-report semantics). The
  `publishTranslation` seam is unchanged.
- **`chatComplete` reasoning opt-out.** `ChatOptions` gains
  `reasoning?: "off"`; when set, the request body carries OpenRouter's
  unified reasoning-disable parameter (exact field verified against OpenRouter
  docs at implementation; the test pins whatever we send).
  `translateField` always passes it; authoring call-sites are untouched.
- **Prompt unchanged** apart from the model now seeing placeholders — the
  existing "preserve EVERY tag/attribute" instruction covers comments.

## Testing Decisions

- **Unit (pure helpers):** round-trip identity on a realistic lesson document
  (styles in head, scripts in foot); order preserved; mismatch cases (model
  drops a placeholder, duplicates one, invents one) all return `null`.
- **Action seam (`internal.translate.translateTopic`, convex-test + fetch
  stub):**
  - the stubbed request body contains **no** `<style>`/`<script>` content and
    does contain placeholders; the published translation row contains the
    restored boilerplate verbatim;
  - the request body carries the reasoning-off parameter;
  - a stub that eats a placeholder → item skipped (no row), job reports
    `ready` with that item in `failed`.

## Out of Scope

- Model downgrade (env-var experiment, post-measurement).
- Prompt caching / batching (cache hit 0% is structural: no shared prefix
  worth caching once boilerplate is gone).
- Authoring-path token use (different provider, different complaint).
- Re-translating existing ready Editions to reclaim past spend.

## Suggested Issue Breakdown

1. **Strip/reassemble static blocks in the translate run** — swap helpers +
   action wiring + action-side quiz-marker check. The big token cut.
2. **Reasoning off for translation calls** — `chatComplete` option +
   `translateField` wiring.
3. **Measurement run** — Test Course smoke, full-course run in a new
   language, record $ + tokens here, decide whether a model change is wanted.
