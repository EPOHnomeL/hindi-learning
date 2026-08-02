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
