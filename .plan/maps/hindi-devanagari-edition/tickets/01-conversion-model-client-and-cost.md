---
type: research
blocked_by: []
---
# Which model, through which existing client, and what does one Edition cost?

> `/wayfinder .plan/maps/hindi-devanagari-edition/tickets/01-conversion-model-client-and-cost.md`

## Question

The conversion pass is a cheap AI call, not a translate run. Which model runs it, reached
through which of the clients this repo already has, and what does converting the whole
prophetic-school `hi-Latn` Edition actually cost?

Ground it in what exists rather than in general model knowledge:

- `convex/geminiClient.ts`, `convex/openrouterClient.ts`, `convex/openrouter.ts`, and the
  `TRANSLATE_PROVIDER` env switch — what is wired, what keys are configured
  (`convex/env.ts`), and which of these a **standalone one-shot script** can use without
  going through Convex at all.
- `docs/translation-model-trial.md` and `topics/prophetic-school/eval/` — this repo has
  already run a blind multi-model trial on this exact corpus, including an `hi-Latn`
  verdict. Read what it concluded before proposing anything new.
- Model ids and current per-token pricing for the two or three cheapest candidates that
  can be trusted with Devanagari orthography. Script conversion is a much easier task than
  translation, so the cheap tier is plausibly enough — say whether the evidence supports that.
- The corpus size: count the `hi-Latn` rows for prophetic-school and their total
  characters, so the cost estimate is a number and not a shrug.

## Done when

A named model + client + call shape is recommended with a second choice behind it, each
with an order-of-magnitude cost for one full Edition, and each claim tied to a file in this
repo or to current provider pricing. Explicitly states whether the script calls a provider
directly or reuses a Convex action, and why.

## Answer

> **SUPERSEDED, 2026-08-02 — same day, later. There is no model and no API cost.**
>
> The user ruled out paid API calls outright: *"That costs money. Rather use claude locally on
> my laptop here in claude code — I want you as my claude code harness to translate it from
> latin → devanagari."* So the converter is **the Claude Code session itself**, and this
> ticket's whole question — which model, through which client, at what cost — is moot.
> Answered instead: **no model, no client, $0 per Edition.**
>
> That was not taken on faith. 02 re-ran the conversion by hand through this harness and
> re-graded it with the same checks: it was **exact on every counted structural property**
> where Gemini had one instability, and it **repaired the source's untranslated English**
> where Gemini shipped it. The free path is also the better path here. See
> [02's Answer](02-does-naturalizing-conversion-hold.md#answer).
>
> What survives from this ticket and is still load-bearing:
>
> - **The corpus numbers** — 59 items, 1.68 MB English source, ~1.03 M chars of romanized
>   HTML in / ~0.83 M chars of Devanagari out. Unchanged, and now they size *sessions*
>   instead of dollars: at ~20 K chars per lesson this is hours of agent work, which is the
>   new binding cost and 03's problem.
> - **The write path** — `readEditionBodies` → disk → `publishTranslation`, both
>   `PUBLISH_SECRET`-guarded, plus the finding that the in-Convex `translateTopic` path
>   **structurally cannot** read `hi-Latn`. All still true and still the plan; only the middle
>   step changed from "call Gemini" to "convert in-session".
> - **The guards** — `swapOutStatic` / `swapBackStatic` / `quizStructureMatches` must run per
>   item regardless of who converts.
>
> What is dead: the model table, the pricing, the `geminiComplete` call shape, the
> `GOOGLE_AI_API_KEY`-in-`.env.local` prerequisite, and the batch-API note. `gemini-3.5-flash`
> remains prod's *translate* default and is untouched by any of this — the ban is scoped to
> this conversion effort.
>
> The original answer is left intact below as the record of what was decided and why.

**Decided, NOT built.** Resolved 2026-08-02 by reading the tree and checking Google's live
pricing page; no call was made and no script was run.

### The recommendation

**`gemini-3.1-flash-lite`, through the existing native `geminiComplete` client
([convex/geminiClient.ts:38](../../../../convex/geminiClient.ts#L38)), called *directly from
a standalone `pnpm tsx` script* — not through any Convex action.** Order **$1** for the whole
prophetic-school Edition.

Second choice: **`gemini-3.5-flash`**, same client, same script, one flag — order **$6**.
It is the model that produced every shipped Edition, and the only one with any observed
Devanagari competence on *this* corpus (below). Dropping to it costs the tier saving but
nothing else; it is a one-line fallback, not a redesign.

| Model | $/M in → out | Est. cost, one full Edition |
| --- | --- | --- |
| `gemini-3.1-flash-lite` **(pick)** | 0.25 → 1.50 | **~$1** ($0.75–1.30) |
| `gemini-3.5-flash` (prod translate default) | 1.50 → 9.00 | **~$6** |
| `gemini-2.5-flash` / `gemini-3.5-flash-lite` | 0.30 → 2.50 | ~$1.70 |
| `gemini-2.5-flash-lite` | 0.10 → 0.40 | ~$0.30 — but **retires 2026-10-16**; don't build on it |

Pricing read live from <https://ai.google.dev/gemini-api/docs/pricing> on 2026-08-02; it
matches the figures `.scratch/translation-cost/04` recorded on 2026-07-13 unchanged, so the
repo's cost thread is still current. Google's Batch API halves both rates — a one-shot
overnight script is exactly the batch use case, so **~$0.50 is reachable** if the spec wants
it, at the price of a second code path. Not recommended for the proof run.

### The corpus, as a number

- **59 translatable items**: 56 lessons (`topics/prophetic-school/lessons/`), the glossary
  reference, plus `title` and `mission`. 59 is corroborated by
  [convex/translate.ts:811](../../../../convex/translate.ts#L811) — "the 56-lesson prod
  course was killed at 28/59".
- English source: **1,679,942 B** across the 56 lessons (avg 29,999 B).
- The `<style>`/`<script>` strip is measured, not assumed: lesson 1 is 26,657 B full →
  **14,684 B stripped** (`topics/prophetic-school/eval/source.{full,stripped}.html`), so
  ~11,973 B per lesson is static boilerplate that never reaches the model
  (`swapOutStatic`, translation-cost/01).
- Shipped `hi-Latn` lesson 1 is **28,334 chars** (`eval/gemini/hi-Latn.html`); the static
  blocks are byte-identical, so **~16,400 chars stripped**. Scaled by the lesson-size ratio
  across all 56 → **~1.03 M chars of romanized-Hindi HTML in, ~0.83 M chars of Devanagari
  HTML out.**
- Tokens: romanized Hinglish tokenizes at ~2.5–3 chars/token and Devanagari at ~1.2–2, so
  **~350–420 K in / ~500–750 K out**. Cross-check against a *measured* run: the 56-lesson
  Afrikaans Edition cost **$6.82** on `gemini-3.5-flash` at 1.50→9.00
  (`.scratch/translation-cost/04`), which back-solves to ~700 K output tokens. Same order.
  The token estimate is the one soft number here; the cost column is right to ~2×.

### Does the cheap tier survive the task? Yes — but for a non-obvious reason

The honest arithmetic first: **cost ≈ tokens × price, and the conversion pass moves the same
corpus through one pass just like a translate run does.** Converting on `gemini-3.5-flash`
costs what translating on `gemini-3.5-flash` costs. *The entire saving is the tier drop* —
the map's "far below a translate run's cost" is true only because script conversion is an
easier task that a cheaper model can do, not because conversion is intrinsically cheap.
Whoever writes the spec should say that out loud.

What licenses the tier drop:

- **The task's failure mode is caught, not shipped.** Structural fidelity is Gemini's
  measured weak spot — it "quietly dropped 3–6 elements per lesson" and fabricated whole
  steps in Afrikaans ([docs/translation-model-trial.md](../../../../docs/translation-model-trial.md)).
  But the strict placeholder reassembly (`swapBackStatic` → `null`) and
  `quizStructureMatches` turn sloppiness into a **skipped item**, never a corrupt one —
  the disqualifier is a `failed` count, which is exactly the protocol
  `.scratch/translation-cost/04` already defines. A cheap model is safe to *try*.
- **Gemini's one hi-Latn defect inverts into an asset here.** The blind trial's single
  script complaint against the shipped hi-Latn edition was *Devanagari leaking into the
  romanized text* — `"par परिस्थिति (circumstances)"`, confirmed present in
  `eval/gemini/hi-Latn.html` (exactly one Devanagari run in the file). Reaching for
  Devanagari unprompted is the failure that made it lose the romanized job and is weak but
  real evidence of the orthography for this one.
- Conversion needs no reasoning at all, and `geminiComplete` already pins
  `thinkingLevel: "minimal"` — the control the OpenRouter path can't honour, which is why
  the native client exists (translation-cost/05, geminiClient.ts header).

### Client and call shape: direct, from a script — the Convex path *structurally cannot* do this

Not a preference. `translateTopic` is **source-driven**: `collectForTranslation`
([convex/translate.ts:723](../../../../convex/translate.ts#L723)) walks the **English**
source and skips anything where `isFresh` matches the stored `sourceHash`. `cloneEdition`
copies rows *with their source hash intact*
([translate.ts:445](../../../../convex/translate.ts#L445)), so every cloned `hi` row is
already fresh — a translate run would do nothing; and `force` would make it re-translate
**from English**, which is the expensive thing this effort exists to avoid. There is no
argument shape that makes the action read `hi-Latn`.

The seams for the script already exist and one of them was written for this exact job.
`readEditionBodies` ([translate.ts:1058](../../../../convex/translate.ts#L1058)) says so in
its own header: *"so the correction CLI can pull an Edition to disk, fix the text, and
republish through `publishTranslation`."* Both are `PUBLISH_SECRET`-guarded and reachable
from `ConvexHttpClient` — the pattern `scripts/clone-edition.ts` and `scripts/xlate-prep.ts`
already use, including importing Convex modules straight into a `pnpm tsx` script.

```
pnpm tsx scripts/clone-edition.ts --topic prophetic-school --from hi-Latn --to hi --prod   # exists
pnpm tsx scripts/devanagari-convert.ts --topic prophetic-school --prod                     # to build
```

Per item: `readEditionBodies("hi")` → fetch the blob via its signed `url` → `swapOutStatic`
→ `geminiComplete({ model: "gemini-3.1-flash-lite", messages })` → `stripFence` →
`swapBackStatic` → `quizStructureMatches` → `publishTranslation`. Two things the *write*
ticket (03) must not miss, noted here and left to it: `publishTranslation`'s own quiz guard
is **skipped for blob-backed sources** (`src.html` is undefined), so the script must run
`quizStructureMatches` itself the way `translateTopic` does at
[translate.ts:858](../../../../convex/translate.ts#L858); and pass `model` explicitly rather
than leaning on `GEMINI_TRANSLATE_MODEL`, which is prod's translate default and must not be
disturbed.

Three further consequences of going out-of-Convex, all in our favour:

- **No execution ceiling.** The in-Convex path needs `CHUNK = 5` and self-rescheduling
  because a 56-lesson run was killed at 28/59 ([translate.ts:810](../../../../convex/translate.ts#L810)).
  A script has no ceiling and can run items concurrently — ~45 s/item serial is ~45 min;
  8-way concurrent is minutes.
- **Prerequisite, small but real:** `GOOGLE_AI_API_KEY` lives on the Convex deployment
  today. The script reads `process.env` via `scripts/_env.ts`, so the key must also be in
  the user's `.env.local` alongside `PUBLISH_SECRET` and `CONVEX_PROD_URL`. `.env` is the
  user's — the spec hands them the line, it does not write it.
- Prod's `TRANSLATE_PROVIDER` / `OPENROUTER_*` config is untouched by any of this.

### One correction to the map

The **Inherited defects** fog patch attributed the untranslated John 16:13 block to the
source Edition. It isn't the source Edition's defect. `eval/judge-map.json` decodes the
blind labels for `hi-Latn` as **A=sonnet, B=opus, C=gemini**, and the English-scripture
defect is candidate **A** — Sonnet 5, a trial candidate that never shipped. The **shipped**
Edition is C, and neither `"When the Spirit of truth"` nor `"For God so loved"` appears in
`eval/gemini/hi-Latn.html`. Its real inherited defects are different, and worse for a
converter told to change script only: the coined `"naye vachisth (new covenant)"`, a garbled
Luke 11:13, English glosses left in prose (`"tauba (repent)"`, `"ek prerana (prompting)"`),
and untranslated UI labels (`Check`, `Sources`, `Glossary`, and the reference-section titles).
The patch has been rewritten on the map to say this. The *question* it raises — repair, flag,
or ship — is unchanged and still clears with 02.

<!-- Correction, 2026-08-02, from ticket 02 (which pulled the real prod row rather than the
     eval packet): `"naye vachisth (new covenant)"` is NOT in the shipped Edition. The stored
     `hi-Latn` row for lesson 0001 reads `nayi vacha (new covenant)` — ordinary, correct Hindi.
     `naye vachisth` exists only in `topics/prophetic-school/eval/gemini/hi-Latn.html`; prod
     diverged from the trial artifact after the trial. The untranslated UI labels are real and
     confirmed. General lesson for anyone reading this ticket: the eval packet is not the
     Edition — grade against `readEditionBodies`. -->

