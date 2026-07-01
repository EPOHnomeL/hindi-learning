# Authoring Contract — the mechanical shape of a lesson

This is the **single source of truth for the mechanics** of authoring a lesson:
file shape, quiz markup, cross-links, citations, immutability. Read this and you
do **not** need to reopen `publish.ts`, the `_partials/`, the `*-FORMAT.md` files
(except when actually writing a glossary or record — see below), or a prior
lesson to reconstruct conventions. `SKILL.md` covers the *teaching* judgement
(ZPD, fluency vs. storage strength, missions); this covers the *plumbing*.

You are working inside a materialised Topic workspace, `topics/<slug>/`. Author
into `topics/<slug>/lessons/`. The shared design system and the reader live in
the repo — you don't touch them; you produce one lean fragment.

## 1. The lesson file is a LEAN FRAGMENT

Copy the skeleton [`lessons/_template.html`](../../../lessons/_template.html) (at
the repo root) to `topics/<slug>/lessons/00NN-<dash-case-name>.html` and fill it
in. Write **content only**.

`publish.ts` wraps every fragment at publish time: it injects `<!DOCTYPE>`,
`<html>`, `<head>` (the whole design system from `lessons/_partials/head.html`),
`<body>`, `<div class="wrap">`, and the quiz-feedback `<script>`
(`lessons/_partials/foot.html`). So **do NOT** write any of: `<!DOCTYPE>`,
`<html>`, `<head>`, `<style>`, `<body>`, `<div class="wrap">`, or a feedback
`<script>`. Inlining them is wrong and will double-wrap. No `<script>` and no
network calls of any kind inside a lesson.

- **First line is the title:** `<title>Lesson N · <display title></title>`. The
  reader shows the text **after** the ` · ` as the lesson's title.
- **Numbering:** `00NN-` is zero-padded and increments from the highest existing
  lesson key. `N` in the title is the human lesson number.

## 2. Immutability & supersession

Published lessons are **immutable** — never edit a file already in the
materialised `lessons/` (those are already live). To correct/replace one, author
a **new** lesson and add, directly under `<title>`:

```html
<meta name="supersedes" content="000X-old-key">
```

Learning records are **append-only**; references **upsert** on content change.

## 3. Quiz markup — the reader captures these attributes, keep them EXACTLY

Two quiz types. The attributes below are read by BOTH the visual feedback script
and the reader's capture bridge (it records the learner's first answer back to
you as ZPD evidence) — do not rename or drop them.

**Multiple choice** — `.quiz[data-correct]` with `.opt[data-k]` buttons:

```html
<div class="quiz" data-correct="b" data-ok="✓ Right — <short why>." data-no="Not quite — re-read §N.">
  <div class="q">1. <question></div>
  <div class="opts">
    <button class="opt" data-k="a"><option a></button>
    <button class="opt" data-k="b"><option b></button>
    <button class="opt" data-k="c"><option c></button>
  </div>
  <div class="fb"></div>
</div>
```

**Fill-in** — `.quiz.fill[data-answer]`:

```html
<div class="quiz fill" data-answer="<exact answer>" data-alt="<optional accepted variant>"
     data-ok="✓ Correct — <why>." data-no="Not yet — <hint>.">
  <div class="q">2. <prompt></div>
  <div style="margin-top:14px">
    <input type="text" autocomplete="off" spellcheck="false" placeholder="…">
    <button>Check</button>
  </div>
  <div class="fb"></div>
</div>
```

- `data-ok` / `data-no` are **optional** custom feedback (HTML allowed); omit for
  sensible defaults. `data-alt` (fill only) accepts one extra correct spelling.
- Answer matching is whitespace-normalised and case/space-exact otherwise.
- **Every MCQ option must be the same word count** (and character count where
  possible) — no formatting or length tells that leak the answer (SKILL.md).

## 4. Components — build from the shared design system, don't inline styles

These classes are defined in `lessons/_partials/head.html` (wrapped on at
publish); use them instead of inventing markup: `.verse`, `.book` (+`.book .ex`),
`.grid2`/`.col.sg`/`.col.pl`/`.row`, `.build`/`.chip`/`.op`/`.res`, `.word`,
`table.paradigm` (+`tr.key`), `.park`, `.note`(`.devo`), `.quiz`/`.opts`/`.opt`,
`.quiz.fill`, `.win`, `.ask`, `.recap`, `.pill`, `mark`(`.r`/`.c`/`.b`/`.j`/`.v`),
`.deva`, `.cite`. Standard structure: `header.lesson` → `.recap` → `.lead` →
numbered `<h2><span class="num">N</span>…` sections → quizzes → `.win` → `.ask` →
`<footer>`. A dark theme is driven by the app; author light and it just works.

## 5. Cross-links between artifacts

Link to sibling lessons and references by their **reader routes** (the `key` is
the filename without `.html`):

- Lesson: `/courses/<slug>/lessons/<key>` (e.g. `/courses/<slug>/lessons/0002-...`)
- Reference: `/courses/<slug>/references/<key>`

## 6. Grounding & citations

Ground every claim in the Topic's own `resources/` (uploaded, primary — see
`resources/_index.json`) and existing `references/`. **Never trust parametric
memory; verify quoted source text character-for-character.**

- Prefer sources **already in the workspace** — resources, references, and the
  `Sources —` footers of prior lessons. If a source was already verified in an
  earlier lesson, reuse it; do **not** re-fetch/re-verify the same URL.
- Litter the lesson with inline citations (`.cite` + `<a>`), and end with a
  `<footer>` `Sources —` line naming what was verified.

## 7. The other two artifacts (update as needed)

- **Glossary / references** (`references/*.html`): keep the glossary current with
  any new term the learner now owns. References are stored **as authored** (they
  are NOT head/foot-wrapped like lessons). Shape: [`GLOSSARY-FORMAT.md`](./GLOSSARY-FORMAT.md).
- **Learning record** (`learning-records/00NN-<dash-case>.md`): one short record
  capturing what this lesson advanced and the next ZPD step. Shape:
  [`LEARNING-RECORD-FORMAT.md`](./LEARNING-RECORD-FORMAT.md).

## 8. ZPD evidence — read, don't re-pull

Your evidence for what to teach next is already on disk after materialise:
`CAPTURE.json` (open questions, quiz responses, progress) + `learning-records/`.
Read them directly. Do **not** run `review:prod` — it re-pulls what `CAPTURE.json`
already holds.

## 9. Publish

`pnpm run publish:prod --topic <slug>` pushes the new lesson, record, and any
changed references to Convex (the source of truth). **Never commit to git** — the
`topics/<slug>/` workspace is transient (ADR 0009).
