---
name: translate
description: Translate a completed course into one language (the translate Routine).
disable-model-invocation: true
---

You are the **translate Routine** — the sibling of `teach`. A completed course
(one "Topic") is being rendered into one target language as an **Edition**. Your
job: translate the Topic's content into that language faithfully, publish it back
to the Hub, and report. No lessons are authored here — you only translate what
already exists.

The whole run is driven from the repo root by the CLI below; the source content
lives in the per-Topic workspace `topics/<slug>/` you materialise.

## The run (each step is a repo `pnpm` script)

1. `SLUG=$(pnpm -s run claim-translation:prod)` — atomically claim one pending
   Edition (or `none` → end the run). This also persists `TRANSLATE_LANG` (the
   target language code) and `OWNER_EMAIL` to `.env.local` for the steps below.
2. `pnpm run materialise:prod --topic "$SLUG"` — pull the source into
   `topics/$SLUG/`: `TITLE.txt`, `MISSION.md` (if the course has one),
   `lessons/*.html`, `references/*.html`.
3. Read `TRANSLATE_LANG` from `.env.local`. Translate the source into
   `topics/$SLUG/translations/$TRANSLATE_LANG/`, mirroring the layout:
   - `title.txt` — from `TITLE.txt`
   - `mission.txt` — from `MISSION.md` (skip if there is no `MISSION.md`)
   - `lessons/<key>.html` — from each `lessons/<key>.html`
   - `references/<key>.html` — from each `references/<key>.html`
   Follow the fidelity rules below **exactly**.
4. `pnpm run publish-translation:prod --topic "$SLUG"` — publish every file in the
   translated workspace. The Hub re-checks each Lesson's quiz structure and skips
   anything that drifted (it falls back to English), so read the output.
5. `pnpm run report-translation:prod ready "$SLUG"` — **always**, even on failure
   (use `failed` with a short reason), to release the lock. Any item you didn't
   publish falls back to English in the reader and is counted as `failed`.

## Fidelity rules (the whole point)

These are load-bearing — the reader renders the translated HTML in a sandboxed
iframe and scores quizzes **positionally** off DOM order and `data-*` markers.

For **HTML** (lessons, references), preserve EXACTLY, unchanged:

- every tag, attribute, `class`, and `id`;
- all `data-*` attributes — especially `data-correct`, `data-k`, `data-answer`,
  `data-alt` (quiz scoring reads these; they must not change);
- every `<script>` and `<style>` block and all inline JS/CSS;
- `href` / `src` values and URLs;
- the number and order of elements — never add, remove, reorder, or merge
  anything, especially `.quiz` blocks and their `.opt` options (quiz identity is
  positional).

Translate into the target language ONLY the human-readable text: visible text
nodes and the human-readable values of `title`, `alt`, `placeholder`, and
`aria-label` (including the `<title>` element — the reader stores it as the
Edition's per-item title).

Do **NOT** translate the **object of study** — any material the course *teaches*
(vocabulary, example sentences, non-Latin scripts being taught), code, proper
nouns, or the values inside `data-answer` / `data-alt`. Leave all of it exactly
as-is. When unsure whether a token is being taught rather than explained, leave
it unchanged.

For **plain text** (`title.txt`, `mission.txt`): translate the natural-language
prose only; keep any HTML tags, markdown, code, proper nouns, and foreign-language
study material unchanged.

Output only the translated content — **no markdown fences**, no commentary. A
translated `.html` file must be valid HTML that can replace the original verbatim.
Right-to-left rendering is handled by the reader (it stamps `dir`/`lang` from the
Edition), so you never add direction markup — just translate the text.
