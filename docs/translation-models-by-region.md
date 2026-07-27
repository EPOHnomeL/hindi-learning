# Best translation models by region — external evidence

Part of the [Translation Model Research](/docs/translation-research.md) section — a
short, sourced survey of which translation models lead **by region**, to sit
alongside our own head-to-head ([translation-model-trial.md](/docs/translation-model-trial.md)).
Our trial is one lesson, 9 languages, human-blind; this page is the wider public
evidence it should be read against. Compiled 2026-07-21 (all sources accessed that
day). Treat as **directional** — model tiers/versions differ across sources and
several regional comparisons are vendor blogs (flagged).

## The openmark.ai ranking — why we don't weight it

<https://openmark.ai/best-ai-for-translation> is a **single-vendor automated
benchmark** (OpenMark's own, ~March 2026), **not** an independent study. It tests
**only 6 high-resource languages** (EN/ES/FR/DE/JA/ZH) with **keyword-match
scoring** (`contains_all`/`contains_any`) — no human eval, no LLM judge. It ranks
Minimax M2.5 top and puts **Claude at the bottom**. We discount it: (1) it covers
**none** of our target low-resource / African / romanized languages; (2)
keyword-contains is a weak proxy for translation fidelity; (3) the site sells a paid
"audit" + free-credit sign-ups (lead-gen conflict of interest). Its Claude-last
result is an **outlier** that conflicts with human-eval evidence below and with our
own trial — most likely a brittle metric on easy languages. Directionally
interesting, not decision-grade.

## Per region

- **Europe** — **DeepL** still leads dedicated-MT on Western European pairs
  (Intento found it top in ~65% of pairs, ~half Google's error rate), but frontier
  LLMs now match or beat it in **WMT25 human eval** (Gemini 2.5 **Pro** topped 14/16
  pairs). Confidence: high.
  ([Slator/WMT25](https://slator.com/wmt25-preliminary-results-gemini-2-5-pro-gpt-4-1-lead-ai-translation/),
  [Smartling](https://www.smartling.com/blog/google-translate-vs-deepl))
- **Asia — Indic** (Hindi/Bengali/Urdu, incl. romanized) — close between frontier
  models; Gemini is strong on low-resource Indic overall while GPT/Claude lead on
  Hindi specifically. Directly relevant to our native-script-leak defect, a 2025
  "Script Gap" paper shows models behave **inconsistently across romanized vs native
  script**. Confidence: medium.
  ([IndicParam, arXiv](https://arxiv.org/html/2512.00333v2),
  [Script Gap, arXiv](https://arxiv.org/pdf/2512.10780))
- **Asia — East/SE Asian** (ZH/JA/KO/TH/VI) — GPT-4o and Claude lead EN→JA/ZH;
  DeepSeek wins Simplified Chinese; Gemini beats DeepL/Google on Thai & Vietnamese.
  Japanese remains hard for all (post-editing expected). Confidence: medium (several
  listicle sources). ([getBLEND](https://www.getblend.com/blog/which-llm-is-best-for-translation/),
  [OpenL](https://blog.openl.io/google-translate-vs-deepl-vs-chatgpt-2026/))
- **Africa** (Bantu/Nguni, Swahili, Amharic, Malagasy) — **Meta NLLB-200** is the
  coverage leader (55 African languages incl. isiZulu/isiXhosa, ~+44% BLEU over prior
  SOTA on FLORES). Off-the-shelf frontier LLMs still **underperform** on low-resource
  African languages — an active research gap. Confidence: high that African
  low-resource is the hardest tier.
  ([Meta NLLB](https://ai.meta.com/blog/nllb-200-high-quality-machine-translation/),
  [African-LLM benchmark, arXiv](https://arxiv.org/html/2412.12417v1))
- **South Africa** (12 official languages incl. SASL) — **Google Translate** covers
  ~6+ (Afrikaans, isiZulu, isiXhosa, Sesotho, Sepedi, Xitsonga); **DeepL does not
  support** the Bantu/Nguni languages (European-focused); **NLLB** is the widest open
  option. Coverage is well-documented; comparative **quality** is barely benchmarked
  publicly. Confidence: high on coverage, low on quality.
  ([SA languages](https://en.wikipedia.org/wiki/Languages_of_South_Africa),
  [Google Translate SA coverage](https://afrolingo.co.za/blog/bridging-gaps-south-african-languages-on-google-translate/),
  [DeepL supported languages](https://developers.deepl.com/docs/getting-started/supported-languages))

## How this squares with our trial

- Our result (**Claude frontier ≥ Gemini 3.5 Flash**) aligns with **WMT24 human
  eval** (Claude 3.5 Sonnet first in 9/11 pairs) and Claude's general "nuance"
  reputation — **but** WMT25 put Gemini 2.5 **Pro** first, and we tested Gemini
  **Flash** (a cheaper tier), so this is fair to Claude but not a Gemini-ceiling test.
- **African low-resource being hardest, and native-script leak as Gemini's main
  defect, is strongly corroborated** (NLLB's rationale, African-benchmark papers, the
  Script-Gap romanization work).
- For **South African Bantu/Nguni quality**, almost no independent public benchmark
  exists — **our own blind review is arguably the better evidence there.**

## Caveats

- Cross-benchmark rankings are **not directly comparable** (Flash vs Pro, GPT-4o vs
  GPT-5.x, different metrics). BLEU/COMET/keyword-match ≠ perceived fidelity; human
  eval (ours + WMT) is more reliable but small-sample.
- Region sources marked as vendor blogs are directional only; primary weight is on
  **WMT25/24, Meta NLLB, and arXiv** papers.
- A dedicated MT engine (**NLLB / Google**) may still beat any general LLM on the
  hardest SA languages purely on training-data coverage — worth a bake-off before
  committing a single model for African editions.
