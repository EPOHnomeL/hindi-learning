# Translation model trial — which model to translate Editions with

A head-to-head of three translation models on the **Editions** path, to answer a
concrete operational question: *is the shipped translate model the right one, and
does the answer change by language?* Sibling of the translation runbook
([translation.md](/docs/translation.md)) — that doc is **how translation is plumbed**;
this is **which model we should plumb it to**, with evidence. Part of the
[Translation Model Research](/docs/translation-research.md) section.

> **TL;DR.** On one lesson across 9 languages, blind prose review ranked
> **Sonnet 5 first in 5 languages, Opus 4.8 in 3, Gemini 3.5 Flash in 1**. The
> shipped Gemini path has two systematic defects the others avoid — it **leaks
> native script into romanized editions** and **drops/invents HTML structure** —
> while the real differentiator between the frontier models is **how each handles
> Scripture**. Full interactive scorecard:
> <a href="/docs/translation-model-trial.html" target="_blank" rel="noopener">translation-model-trial.html</a>
> (self-contained; open in any browser).

Date: 2026-07-21. Run by the `translate`-skill fidelity rules
([the translate SKILL.md](/.agents/skills/translate/SKILL.md)).

---

## Why this trial

Every shipped Edition today is translated by **Gemini 3.5 Flash** (the default
`geminiComplete` provider in [`convex/translate.ts`](../convex/translate.ts)). It is
frontier-priced and was never A/B'd against alternatives on real course content.
Before changing the default (or picking a per-language model), we wanted to know
where the shipped model actually stands against the two Claude frontier models on
the exact production translation path.

This complements [`.scratch/translation-cost/`](../.scratch/translation-cost/) —
that thread chases **cost**; this one measures **quality**.

## What was tested

- **Source:** `prophetic-school` Lesson 1, "Learning to Listen" (26 KB — 3 quizzes,
  3 Bible verses, book/note cards, a "Sources" citation footer). Rich enough to
  exercise every fidelity rule.
- **Languages (9):** the full set of shipped `prophetic-school` editions —
  `es, fr, af, mg, ur, zu, xh, hi-Latn, bn-Latn`. A deliberate spread: European
  (es/fr/af), RTL (ur), lower-resource African (mg/zu/xh), and romanized-script
  targets (hi-Latn/bn-Latn) that stress the single-script rule.
- **Models (3):**
  - **Gemini 3.5 Flash** — represented by the **currently-shipped** translation
    (read from prod), since all live editions were produced by it.
  - **Sonnet 5** and **Opus 4.8** — generated fresh for this trial.

## Method

Everything ran through the **real production path**, so the test measures what
would actually ship, not a lookalike:

1. **Pull the source + shipped editions from prod** using only the secrets already
   in `.env.local` (`PUBLISH_SECRET`, `CONVEX_PROD_URL`) — no dashboard, no login:
   `materialise:prod` for the English source, and the secret-guarded
   `translate.readEditionBodies` for each existing (Gemini) edition.
2. **Strip + prompt exactly like production.** The source was run through the real
   `swapOutStatic` (static `<style>`/`<script>` blocks → placeholders) and the real
   `buildTranslateMessages` prompt for each language. Sonnet 5 and Opus 4.8 each
   translated that stripped source.
3. **Reassemble + guard exactly like production.** Each candidate was put back
   together with the real `swapBackStatic` and checked with the real
   `quizStructureMatches` — the same guard that would reject a drifted quiz at
   publish time.
4. **Grade on two axes:**
   - **Deterministic fidelity** (a scripted harness): quiz-marker survival, static
     block integrity, HTML element-count delta, wrong-script character leaks,
     verses-left-in-English, and a language-agnostic English-leak signal (verbatim
     6-word shingles from the source surviving in the output).
   - **Blind prose review:** one **Opus 4.8 judge per language** scored the three
     candidates (accuracy / fluency / terminology, 1–10) *blind* — anonymized
     A/B/C, order **rotated per language** to cancel position bias — and ranked them
     with concrete defect quotes.

## Findings

### Ranking (blind prose, best model per language)

| Winner | Languages |
| --- | --- |
| **Sonnet 5** | Spanish, French, Malagasy, Urdu, Romanized Bengali |
| **Opus 4.8** | Afrikaans, Zulu, Romanized Hindi |
| **Gemini 3.5 Flash** | Xhosa (only) |

Per-language scores, confidence, and defect quotes are in the scorecard.

### The three trends that matter more than the ranking

1. **Scripture handling is the real dividing line between the frontier models.**
   The lesson quotes the Bible, and the fidelity rule is specific: substitute a
   *published* target-language translation verbatim, or fall back to the source
   language — **never invent or back-translate**.
   - **Gemini** always fills verses in, but sometimes **invents or scrambles** them
     (mangled references in Urdu; a coined "new covenant" *inside* a Hindi verse —
     precisely the rule violation the skill warns about).
   - **Sonnet** plays it safe and leaves verses in **English** for every harder
     language (zu, xh, hi-Latn, bn-Latn) — safe, but incomplete for a
     scripture-based lesson.
   - **Opus** threads it: genuine published wording where it is confident (the
     correct romanized-Hindi John 3:16), English fallback only for Bengali. This is
     the behaviour the rule actually asks for.

2. **Only Gemini leaks native script into romanized editions.** Devanagari bled
   into Romanized Hindi ("par परिस्थिति"), and Devanagari/Bengali into Romanized
   Bengali — the mixed-script failure the rules explicitly forbid. Sonnet and Opus
   kept every romanized edition in clean Latin script (**0 leaks**).

3. **Structural fidelity: Opus > Sonnet > Gemini.** Opus preserved the HTML element
   count **exactly** in all 9 languages; Sonnet dropped a handful; **Gemini quietly
   dropped 3–6 elements per lesson** (23 total) and, in Afrikaans, **fabricated
   whole steps** absent from the source. All three cleared the hard quiz-scoring
   guard (9/9), so none would ship a *broken* quiz — the differences are all in what
   the guard doesn't catch. Recurring shared miss across **all three**: the
   fill-in-the-blank quiz Q4 stem and the "Check" button often left in English.

### Reasoning effort — the biggest confound

The production translate path deliberately runs with **reasoning/thinking
disabled** — OpenRouter `reasoning: { effort: "none" }` and native Gemini
`thinkingLevel: "minimal"` (translation-cost 02/05). The rationale is cost:
thinking tokens bill as *output*, and were judged to buy nothing for a constrained
HTML transform.

That creates an asymmetry this trial did **not** control for:

- The shipped **Gemini** editions were produced with thinking pinned to minimal —
  i.e. the cheap production setting.
- The **Sonnet 5 / Opus 4.8** candidates were generated at their **default
  reasoning effort**, *not* forced off.

So part of the Claude models' edge — especially the careful Scripture handling and
exact structural preservation — may come from reasoning the production path
currently switches off to save money. Translation is mostly a mechanical,
constrained transform (preserve structure, swap prose), where minimal reasoning is
usually adequate; but the two places the frontier models actually separated —
**published-verse substitution** and **single-script discipline** — are judgement
calls, exactly where a little reasoning could be doing the work. That should be
measured, not assumed. Two consequences:

1. **The cost win and the quality result may be in tension.** If we adopt a Claude
   model for translation, the cheap "reasoning off" configuration is *not* the one
   measured here — so this ranking can't be read as a drop-in cost-neutral swap.
2. **Follow-up before deciding:** re-run Sonnet 5 / Opus 4.8 with reasoning
   disabled and re-grade. If quality holds, we get quality *and* cost; if it drops,
   model choice and reasoning budget have to be decided together (possibly per
   language — the low-resource and romanized editions are the likeliest to need the
   extra thinking).

### Other caveats

- **One lesson, one run.** Directional, not definitive — extend to more lessons
  before treating the ranking as settled.
- **Low-resource languages are medium-confidence.** For mg/zu/xh/hi-Latn/bn-Latn the
  judge is an LLM near its own ceiling; read those rows as directional.
- **The Gemini column is a _historical_ edition, not current-skill Gemini.** The
  shipped translations were produced by an **earlier version of the `translate`
  skill**, before its fidelity rules were hardened (commit `c341c2b`, "harden
  fidelity rules from graded Hindi output"). Several defects charged to Gemini here
  — native-script leaks, a coined word inside a verse, dropped structure — are
  *precisely* what the newer rules target, so **current-prompt Gemini could score
  higher**; a fair re-run must re-translate the Gemini column under today's skill.
  (`ur` was also hand-corrected on 2026-07-15 — see [translation.md §8](/docs/translation.md).)
  Read this column as *"what's live"*, not a clean current-prompt baseline.
- **Not measured:** cost and latency, and whether Gemini's filled-in verses match an
  actual published Bible (only that it produced *something* in-language).

## How to reproduce

The harness is scripted end-to-end (reads prod with `.env.local` secrets only):

```bash
pnpm tsx scripts/probe-editions.ts --topic prophetic-school --key 0001  # discover editions
pnpm run materialise:prod --topic prophetic-school                       # pull English source
pnpm tsx scripts/xlate-prep.ts     # strip source, fetch shipped Gemini editions, emit prompts
# generate Sonnet 5 / Opus 4.8 translations of topics/prophetic-school/eval/source.stripped.html
#   into topics/prophetic-school/eval/{sonnet,opus}/<lang>.stripped.html (one agent per lang/model)
pnpm tsx scripts/xlate-grade.ts        # deterministic fidelity scorecard
pnpm tsx scripts/xlate-judge-prep.ts   # build blind A/B/C judge packets (rotated order)
# run one prose judge per language over the packets, writing <lang>.verdict.json
pnpm tsx scripts/xlate-report.ts       # merge verdicts + mechanical → report.json
```

All intermediate artefacts land under `topics/prophetic-school/eval/` (gitignored).
The published scorecard was rendered from that data into
[translation-model-trial.html](translation-model-trial.html).
