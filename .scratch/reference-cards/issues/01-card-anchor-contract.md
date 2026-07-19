# reference-cards/01: Card anchor contract — stable ids on glossary entries

**Status:** resolved (2026-07-19)
**Labels:** ready-for-agent
**Depends on:** none (foundation for 02 and 03)
**Domain:** [[Reference]], [[Lesson]] (CONTEXT.md)

## Resolution (2026-07-19)

Contract landed as authoring guidance (no runtime code — the reader reads the authored `id`, never
recomputes a slug):
- `AUTHORING.md` §7 (both `.claude/` and `.agents/` trees): every glossary entry (`.term` / `.word`)
  carries `id="<slug>"`; slug rule + worked example; ids are stable, never renumbered.
- `lessons/_partials/reference-head.html`: design-system header comment notes the id convention.
- **Not** `GLOSSARY-FORMAT.md` — that governs the markdown `GLOSSARY.md` canonical-language file,
  which carries no HTML ids. The HTML id contract belongs in AUTHORING §7 (reference-HTML authoring).
- Existing seed references (`references/ref-*.html`) left unchanged — that's backfill (ticket 04).

## Problem

The reference design system ([reference-head.html](../../../lessons/_partials/reference-head.html))
renders each glossary entry as either a **`.term`** card (`.name` + `.def` + `.avoid`) or a compact
**`.word`** row (`.w` headword + `.g` gloss). Neither carries an **id**, so nothing can address a
single card — not a deep-link (02), not a share button (03). We need a stable, language-independent
anchor on each entry, authored at generation time.

## Solution

Extend the reference authoring contract so the teach skill emits `id="<slug>"` on **every glossary
entry element** (`.term` or `.word`). That's the whole change — `.def` already exists on `.term`,
and `.word` already carries its parts, so no new wrapper markup is needed. 02 and 03 read
term/definition from the existing sub-elements.

This is **authoring guidance + format**, not runtime code. New glossaries get anchorable cards; old
ones are untouched (backfill = ticket 04).

## Implementation Decisions

- **Card = `.term` or `.word`.** Both are glossary entries; both get an `id`. The reader selects
  them as `.term[id], .word[id]` (02/03).
- **Slug source is ASCII, per shape.** The id must be a readable ASCII slug so the skill can link
  it from a Lesson without fabricating an opaque string, and it must be **language-stable** (same
  across every Edition — the translate pass preserves attributes verbatim):
  - `.term` → slug of the `.name` term text (already Latin/English).
  - `.word` → slug of the entry's **`.tr` transliteration** (the headword `.w` is Devanagari, which
    doesn't slug to ASCII) — e.g. `dhanya`, `puruṣ` → `dhanya`, `purus`.
- **Slug rule.** Lowercase; strip diacritics/ASCII-fold; spaces/punctuation → single hyphens; trim
  leading/trailing hyphens. Collisions within one reference get a `-2`, `-3` suffix. Document the
  exact rule in the format so the skill is deterministic.
- **Term/definition extraction** (for 03's share snippet), by shape:
  - `.term`: term = `.name`, definition = `.def`.
  - `.word`: term = `.w` headword (+ `.tr` if useful), definition = `.g` (its `<b>` meaning + gloss).
- **Markup shape** — the ONLY addition is the `id`:
  ```html
  <div class="term" id="perfective-aspect">
    <span class="name">Perfective aspect</span>
    <div class="def">An action viewed as a complete whole, not its internal unfolding.</div>
    <p class="avoid"><b>Avoid</b>: completed tense</p>
  </div>

  <div class="word" id="dhanya"><div class="w deva">धन्य</div>
    <div class="g"><span class="tr">dhanya</span> — <b>blessed</b>, fortunate…</div></div>
  ```
- **Files:**
  - `.claude/skills/teach/GLOSSARY-FORMAT.md` — add the id rule to the structure/rules.
  - `.claude/skills/teach/AUTHORING.md` §7 (and §5 cross-link note for 02) — glossary entries carry ids.
  - Keep the `.agents/skills/teach/` tree in sync (mirror both files).
  - Optionally note the id convention in [reference-head.html](../../../lessons/_partials/reference-head.html)'s
    header comment (design-system doc), since that's where `.term`/`.word` are defined.
- **No runtime code change in this ticket.** The renderer passes authored HTML through; ids ride
  along. 02 and 03 consume them.
- **Graceful when absent.** A reference with no ids (old content, freeform/tabular reference) simply
  offers no anchors/share — 02 and 03 must no-op, not error.

## Testing Decisions

- The substance here is skill guidance (prose), so the "test" is a **worked example** in
  GLOSSARY-FORMAT.md that a skill run can copy, plus an acceptance check to eyeball a freshly
  authored glossary for ids on every `.term`/`.word`.
- If a slug helper is factored into code (shared with 02/03's tests), unit-test the slug rule:
  case fold, diacritic/ASCII fold, punctuation → hyphen, collision suffixing.

## Out of Scope

- Retrofitting ids into existing References (ticket 04).
- Any reader/bridge behaviour (02, 03).
</content>
