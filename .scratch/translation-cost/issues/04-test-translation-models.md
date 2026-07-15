# translation-cost/04: Test cheaper translation models

**Status:** open
**Depends on:** the measurement run (GitHub #40) — same Test Course protocol
**Labels:** needs-info (pick winners by eyeball + failed counts)

Child of [.scratch/translation-cost/PRD.md](../PRD.md).

## Why

The default translate model `google/gemini-3.5-flash` is priced like a frontier
model on OpenRouter — **$1.50/M input, $9.00/M output** (checked live
2026-07-13). That's the main reason the 56-lesson Afrikaans run cost $6.82.
With the boilerplate strip + reasoning-off shipped (#38/#39), **model choice is
now the biggest remaining cost lever**: even staying in the Gemini family one
tier down is ~6× cheaper, and the budget tier is ~50× cheaper on output.

No code change needed — `OPENROUTER_TRANSLATE_MODEL` is read per-deployment:

```
npx convex env set OPENROUTER_TRANSLATE_MODEL <slug> --prod
```

## Candidates (live pricing, 2026-07-13)

| Model slug | $/M in → out | Notes |
| --- | --- | --- |
| `google/gemini-3.5-flash` (current) | 1.50 → 9.00 | Baseline. Frontier-priced. |
| `google/gemini-3.1-flash-lite` | 0.25 → 1.50 | Same family — least behavior drift on the HTML/placeholder rules. **Try first.** |
| `deepseek/deepseek-v4-flash` | 0.077 → 0.154 | ~50× cheaper output; strong multilingual; 1M ctx. Full course ≈ 2–5 cents. **Try second.** |
| `qwen/qwen3.5-flash-02-23` | 0.065 → 0.26 | Qwen's broad-multilingual pitch; 1M ctx. |
| `mistralai/mistral-small-3.2-24b-instruct` | 0.075 → 0.20 | European-language strength; Afrikaans is Dutch-derived. |
| `google/gemini-3-flash-preview` | 0.50 → 3.00 | Fallback if the budget tier disappoints — still 3× cheaper than today. |

Expected full-course (56-lesson) cost with the strip in place: ~$1.05 on the
current model → **~$0.15–0.20** on gemini-3.1-flash-lite → **~$0.02–0.05** on
deepseek-v4-flash.

## Constraints

- **No "thinking" model variants** (e.g. `qwen3-*-thinking`): the translate
  path always sends `reasoning: { effort: "none" }` (translation-cost 02), and
  mandatory-reasoning models reject that — the job would fail.
- The quality bar is **discipline, not prose**: placeholders (`<!--⟦N⟧-->`)
  and quiz attributes must survive verbatim. The strict reassembly check makes
  a sloppy model *visible* (item → English fallback, `failed` ticks up), never
  destructive — a high `failed` count is the disqualifier.

## Protocol

1. Set the env var to a candidate.
2. Translate the **Test Course** into a fresh language (~6 items, cents).
3. Record: `failed` count on the job, eyeball of prose quality, $ from the
   OpenRouter dashboard.
4. Remove the edition, repeat with the next candidate.
5. Winner: cheapest model with `failed: 0` and acceptable prose. Run one full
   Growing-course language on it, record the real $ here and in the PRD, and
   leave the env var set to it.

## Results

| Model | failed | prose | $ (test) | $ (full course) |
| --- | --- | --- | --- | --- |
| _(fill in per run)_ | | | | |
