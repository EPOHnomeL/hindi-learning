<style>
  .tmr{--exc:rgba(63,111,94,.20);--good:rgba(63,111,94,.10);--mid:rgba(196,150,60,.16);
       --weak:rgba(190,110,55,.17);--poor:rgba(190,70,60,.20);--ring:var(--primary)}
  :root[data-theme="dark"] .tmr{--exc:rgba(121,179,155,.24);--good:rgba(121,179,155,.12);
       --mid:rgba(221,180,99,.18);--weak:rgba(221,140,90,.18);--poor:rgba(224,110,96,.22)}
  .tmr{margin:22px 0 8px}
  .tmr .tally{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 22px;padding:0;list-style:none}
  .tmr .chip{display:inline-flex;align-items:baseline;gap:8px;background:var(--card);
       border:1px solid var(--border);border-radius:999px;padding:7px 15px 7px 12px;font-size:14px}
  .tmr .chip b{font-size:16px;font-variant-numeric:tabular-nums}
  .tmr .chip .dot{width:9px;height:9px;border-radius:50%;align-self:center}
  .tmr .g{background:#bf7433}.tmr .s{background:#3f8a76}.tmr .o{background:#6a5aa0}
  .tmr .chip .m{color:var(--muted-fg)}
  .tmr table.heat{width:100%;border-collapse:separate;border-spacing:0;margin:0;font-size:14px}
  .tmr table.heat th,.tmr table.heat td{border:none;padding:0}
  .tmr table.heat thead th{padding:0 0 10px;text-align:center;font-size:12.5px;color:var(--muted-fg);font-weight:600}
  .tmr table.heat thead th .sw{display:inline-block;width:22px;height:4px;border-radius:2px;margin-bottom:5px}
  .tmr table.heat thead th:first-child{text-align:left}
  .tmr .lang{font-weight:600;white-space:nowrap;padding:6px 14px 6px 2px !important;border-top:1px solid var(--border) !important}
  .tmr .lang small{color:var(--muted-fg);font-weight:400;margin-left:6px;font-size:11.5px}
  .tmr td.c{border-top:1px solid var(--border) !important}
  .tmr .cell{position:relative;margin:4px;border-radius:9px;padding:11px 6px 9px;text-align:center;border:1px solid var(--border)}
  .tmr .cell .n{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1}
  .tmr .cell .r{font-size:10.5px;color:var(--muted-fg)}
  .tmr .s-exc{background:var(--exc)}.tmr .s-good{background:var(--good)}
  .tmr .s-mid{background:var(--mid)}.tmr .s-weak{background:var(--weak)}.tmr .s-poor{background:var(--poor)}
  .tmr .win{border:2px solid var(--ring);box-shadow:0 0 0 1px var(--ring) inset;font-weight:700}
  .tmr .win .badge{position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:var(--primary);
       color:#fff;font-size:9px;font-weight:700;letter-spacing:.08em;padding:1px 7px;border-radius:999px}
  .tmr .legend{display:flex;flex-wrap:wrap;gap:8px 16px;margin:14px 0 0;font-size:12px;color:var(--muted-fg);align-items:center}
  .tmr .legend .k{display:inline-flex;align-items:center;gap:6px}
  .tmr .legend .box{width:13px;height:13px;border-radius:3px;border:1px solid var(--border)}
</style>

# Translation Model Research

Which model should render course **Editions**, and does the answer change by
language? This section holds our own head-to-head plus the wider public evidence it
should be read against.

<div class="tmr">
<ul class="tally">
  <li class="chip"><span class="dot s"></span><b>5</b> <span class="m">Sonnet 5 wins</span></li>
  <li class="chip"><span class="dot o"></span><b>3</b> <span class="m">Opus 4.8 wins</span></li>
  <li class="chip"><span class="dot g"></span><b>1</b> <span class="m">Gemini 3.5 wins</span></li>
</ul>

<table class="heat">
  <thead><tr>
    <th>Language</th>
    <th><span class="sw g" style="display:block;margin:0 auto 5px"></span>Gemini 3.5<br>Flash <small>(shipped)</small></th>
    <th><span class="sw s" style="display:block;margin:0 auto 5px"></span>Sonnet 5</th>
    <th><span class="sw o" style="display:block;margin:0 auto 5px"></span>Opus 4.8</th>
  </tr></thead>
  <tbody>
    <tr><td class="lang">Spanish <small>es</small></td>
      <td class="c"><div class="cell s-mid"><div class="n">6.3</div><div class="r">#3</div></div></td>
      <td class="c"><div class="cell s-exc win"><span class="badge">BEST</span><div class="n">8.7</div><div class="r">#1</div></div></td>
      <td class="c"><div class="cell s-exc"><div class="n">8.0</div><div class="r">#2</div></div></td></tr>
    <tr><td class="lang">French <small>fr</small></td>
      <td class="c"><div class="cell s-good"><div class="n">7.7</div><div class="r">#2</div></div></td>
      <td class="c"><div class="cell s-exc win"><span class="badge">BEST</span><div class="n">8.7</div><div class="r">#1</div></div></td>
      <td class="c"><div class="cell s-good"><div class="n">7.0</div><div class="r">#3</div></div></td></tr>
    <tr><td class="lang">Afrikaans <small>af</small></td>
      <td class="c"><div class="cell s-weak"><div class="n">5.3</div><div class="r">#3</div></div></td>
      <td class="c"><div class="cell s-mid"><div class="n">6.7</div><div class="r">#2</div></div></td>
      <td class="c"><div class="cell s-good win"><span class="badge">BEST</span><div class="n">7.7</div><div class="r">#1</div></div></td></tr>
    <tr><td class="lang">Malagasy <small>mg</small></td>
      <td class="c"><div class="cell s-weak"><div class="n">5.3</div><div class="r">#3</div></div></td>
      <td class="c"><div class="cell s-exc win"><span class="badge">BEST</span><div class="n">8.0</div><div class="r">#1</div></div></td>
      <td class="c"><div class="cell s-mid"><div class="n">6.7</div><div class="r">#2</div></div></td></tr>
    <tr><td class="lang">Urdu <small>ur · RTL</small></td>
      <td class="c"><div class="cell s-mid"><div class="n">6.7</div><div class="r">#3</div></div></td>
      <td class="c"><div class="cell s-exc win"><span class="badge">BEST</span><div class="n">8.3</div><div class="r">#1</div></div></td>
      <td class="c"><div class="cell s-good"><div class="n">7.3</div><div class="r">#2</div></div></td></tr>
    <tr><td class="lang">Zulu <small>zu</small></td>
      <td class="c"><div class="cell s-poor"><div class="n">4.7</div><div class="r">#3</div></div></td>
      <td class="c"><div class="cell s-mid"><div class="n">6.0</div><div class="r">#2</div></div></td>
      <td class="c"><div class="cell s-exc win"><span class="badge">BEST</span><div class="n">8.0</div><div class="r">#1</div></div></td></tr>
    <tr><td class="lang">Xhosa <small>xh</small></td>
      <td class="c"><div class="cell s-good win"><span class="badge">BEST</span><div class="n">7.7</div><div class="r">#1</div></div></td>
      <td class="c"><div class="cell s-weak"><div class="n">5.7</div><div class="r">#3</div></div></td>
      <td class="c"><div class="cell s-good"><div class="n">7.3</div><div class="r">#2</div></div></td></tr>
    <tr><td class="lang">Romanized Hindi <small>hi-Latn</small></td>
      <td class="c"><div class="cell s-weak"><div class="n">5.7</div><div class="r">#3</div></div></td>
      <td class="c"><div class="cell s-good"><div class="n">7.0</div><div class="r">#2</div></div></td>
      <td class="c"><div class="cell s-exc win"><span class="badge">BEST</span><div class="n">8.0</div><div class="r">#1</div></div></td></tr>
    <tr><td class="lang">Romanized Bengali <small>bn-Latn</small></td>
      <td class="c"><div class="cell s-poor"><div class="n">4.3</div><div class="r">#3</div></div></td>
      <td class="c"><div class="cell s-good win"><span class="badge">BEST</span><div class="n">7.7</div><div class="r">#1</div></div></td>
      <td class="c"><div class="cell s-good"><div class="n">7.3</div><div class="r">#2</div></div></td></tr>
  </tbody>
</table>
<div class="legend">
  <span>Blind prose score (accuracy · fluency · terminology, 1–10):</span>
  <span class="k"><span class="box s-poor"></span>&lt;5</span>
  <span class="k"><span class="box s-weak"></span>5</span>
  <span class="k"><span class="box s-mid"></span>6</span>
  <span class="k"><span class="box s-good"></span>7</span>
  <span class="k"><span class="box s-exc"></span>8+</span>
  <span style="margin-left:auto">◻ outlined = judge’s #1</span>
</div>
</div>

> ### ⚠ Read the two big caveats before trusting the ranking
>
> **1 · The Gemini column is a _historical_ snapshot, not current-skill Gemini.**
> The shipped editions were produced by an **earlier version of the `translate`
> skill**, before its fidelity rules were hardened (see commit `c341c2b`,
> "harden fidelity rules from graded Hindi output"). Several of Gemini's defects
> here — native-script leaks, a coined word inside a verse, dropped structure — are
> *exactly* what the newer rules target, so **current-prompt Gemini could score
> higher.** A fair re-run would re-translate the Gemini column under today's skill.
>
> **2 · Reasoning effort was not held constant.** Production forces reasoning **off**
> for translation to save cost; the Sonnet 5 / Opus 4.8 candidates ran at **default
> reasoning**. So part of the Claude edge may be reasoning the shipped path disables —
> **this is not a cost-neutral swap.** Re-test the Claude models with reasoning off.

## The two documents here

- **[Translation model trial](/docs/translation-model-trial.md)** — the full
  head-to-head: method, deterministic fidelity checks, blind prose review,
  per-language defects, and how to reproduce.
- **[Translation models by region](/docs/translation-models-by-region.md)** —
  external evidence (WMT, NLLB, arXiv) on the best models for Europe, Asia, Africa,
  and South Africa, plus why we don't weight the openmark.ai ranking.

**Interactive scorecard** (self-contained, shareable):
<a href="/docs/translation-model-trial.html" target="_blank" rel="noopener">open <code>docs/translation-model-trial.html</code></a> in any browser.

## What we found

- **Scripture handling is the real dividing line.** Gemini always fills verses but
  sometimes invents/scrambles them; Sonnet plays safe and leaves them in English on
  harder languages; **Opus threads it** — published wording where confident, English
  fallback only for Bengali.
- **Only Gemini leaks native script** into the romanized editions (Devanagari into
  Romanized Hindi/Bengali). Sonnet and Opus stayed pure-Latin.
- **Structure: Opus > Sonnet > Gemini.** Opus preserved element count exactly in all
  9; Gemini dropped 3–6 per lesson and fabricated steps in Afrikaans. All three
  cleared the hard quiz-scoring guard.

## Open questions / next

1. **Re-baseline Gemini** under the current `translate` skill (caveat 1) before any
   model decision.
2. **Reasoning-off re-run** of Sonnet 5 / Opus 4.8, re-graded (caveat 2).
3. **Cost + latency** per model — not yet measured.
4. For African editions, **bake off against a dedicated engine** (NLLB / Google),
   which may beat any general LLM on coverage alone.
