---
name: translate
description: Translate a completed course into one language (the translate Routine).
disable-model-invocation: true
---

You are the **translate Routine** — the sibling of `teach`. A **completed** course
(one Topic) is being rendered into one target language as an **Edition**. You
render the Topic's existing content into that language, publish it back to the
Hub, and report. You never author — not a lesson, not a mission; you only
translate what is already there.

The run is driven from the repo root by the `pnpm` scripts below. The source you
translate lives in the per-Topic workspace `topics/<slug>/` you materialise.

## The run

Each step is a repo `pnpm` script; run them in order.

1. `SLUG=$(pnpm -s run claim-translation:prod)` — atomically claim one pending
   Edition. It prints the slug, or `none` → **end the run, nothing to do.** It
   also persists `TRANSLATE_LANG` (the target language code) and `OWNER_EMAIL` to
   `.env.local` for the owner-scoped steps below.
2. `pnpm run materialise:prod --topic "$SLUG"` — pull the source into
   `topics/$SLUG/`: `TITLE.txt`, `MISSION.md` (only if the course has one),
   `lessons/<key>.html`, `references/<key>.html`.
3. Read `TRANSLATE_LANG` from `.env.local`, then translate the source into
   `topics/$SLUG/translations/$TRANSLATE_LANG/`, mirroring the layout exactly:
   - `title.txt` ← `TITLE.txt`
   - `mission.txt` ← `MISSION.md` (skip if there is no `MISSION.md` — never draft
     one, that is `teach`'s job)
   - `lessons/<key>.html` ← each `lessons/<key>.html`
   - `references/<key>.html` ← each `references/<key>.html`

   Apply the **fidelity** rules below to every file. **Done only when every source
   item above** — the title, the mission if present, and *each* lesson and
   reference — **has a counterpart at its mirrored path.** A missing file falls
   back to English and is counted as failed, so translate them all.
4. `pnpm run publish-translation:prod --topic "$SLUG"` — publish every translated
   file (the per-item title is read from each HTML's `<title>`). **Read the
   output:** each item prints `saved` or `skipped`. A `skipped` lesson means its
   quiz markers drifted from the source — fix that file's quiz structure to match
   and re-run publish before reporting.
5. `pnpm run report-translation:prod ready "$SLUG"` — **always run this, even if a
   step failed** (then use `failed "$SLUG" "<reason>"`), to release the lock. Run
   it exactly once, last.

## Fidelity — the whole point

Translate the prose a **learner** reads. Leave two things byte-for-byte unchanged:
everything the **scorer** reads — the machine that grades quizzes — and the
**object of study**, the material the course teaches. Quiz identity is
**positional** (the reader derives it from DOM order and the `data-*` markers), so
structure is load-bearing.

**Preserve exactly** — never translate, reorder, add, or remove:

- every tag, attribute, `class`, and `id`, and the number and order of elements —
  especially `.quiz` blocks and their `.opt` options (a reordered option or a
  changed key silently misgrades);
- every quiz scoring marker verbatim: `data-correct`, each `.opt`'s `data-k`, and
  fill-in `data-answer` / `data-alt`;
- every `<script>` and `<style>` block and all inline JS/CSS, and every `href` /
  `src`;
- the **object of study** — the *target-language* material the course teaches:
  its vocabulary, example sentences, and the script being taught — plus code and
  proper nouns, even when they sit inside prose you are translating. This is the
  language being taught, **not** every term the course names. A concept the course
  *explains* in the **source language** — study-science jargon such as "storage
  strength", "spacing", "interleaving", "retrieval", or any coined key term — is
  learner-read prose: **translate it**, even when it is highlighted (`<mark>`),
  bold, or sitting in a heading. A highlight marks a term as important; it never
  means "leave untranslated." When unsure, decide by language: a source-language
  token is prose → translate it; a target-language token is the object of study →
  keep it.

**Translate** — the learner-read prose only:

- visible text nodes;
- the `<title>` element (the reader stores it as the Edition's per-item title);
- the human-readable values of `title`, `alt`, `placeholder`, and `aria-label`;
- the quiz feedback in `data-ok` / `data-no` (translating these is the only safe
  way to localise feedback — keep any object-of-study tokens inside them as-is).

**Quoted and cited passages are learner-read prose — translate them.** This is the
single most common miss: the narration gets translated while the quotations it
introduces are left in the source language. A verbatim quote the course cites (a
`.book` / `.note` / `.verse` card, a block quote, an epigraph) **and the entire
"Sources" / citation footer** (`<footer>` — the "ذرائع / حوالہ جات / Sources"
apparatus that quotes the source works) are read by the learner and **must** be
rendered in the target language, exactly like body prose. Never leave a quoted
teaching passage in the source language just because it is a quotation. What you
keep inside such a citation is only the **attribution**: author names, the *titles*
of works (e.g. *Walking in Power*), proper nouns, and the page / verse references —
translate the quoted words themselves. (Scripture quotations follow the
published-Bible rule below.) A fill-in-the-blank quiz whose answer is a
**source-language** word (the blank asks the learner to type that word) is object
of study — keep its sentence in the source language.

> The server-side guard only compares the **counts** of
> `data-correct`/`data-answer`/`data-k`; it does **not** catch a changed key value
> or a reordered option. Getting those right is your job, not the guard's.

**Scripture uses an existing translation, not yours.** When the prose quotes the
Bible — a `.verse` block, a cited passage, an epigraph — do not translate the
English yourself. Substitute the wording of a widely-used published Bible in the
target language **verbatim** (e.g. the Afrikaanse Bybel for Afrikaans; the Bible
Society of India / HHBD Devanagari text for Hindi) and leave the reference as-is, so
the learner meets Scripture in its familiar published form, not a back-translation.
If you cannot reproduce a reliable published rendering, leave that quotation in the
source language rather than invent one. When the source has already pasted the
canonical verse in, treat it as object of study and leave it byte-for-byte.

**Never coin a word** — anywhere, but a coined word *inside a verse* is the worst
place to hallucinate. Use only real, standard, correctly-spelled words of the target
language. If you catch yourself appending an English gloss after a term you produced
— "*vachisth* (new covenant)" — that gloss confesses the term is invented; drop both
and use the real standard term (नई वाचा / *nayi vaacha*).

**One script per Edition, no leaks.** Write the whole file in the target Edition's
script: a Devanagari Edition (`hi`, `mr`, `ne`, …) is pure Devanagari; a `-Latn`
Edition is pure Latin. Never let the other script leak in mid-sentence ("par
परिस्थिति (circumstances)"), and translate everyday vocabulary consistently rather
than leaving some source-language words among their translated neighbours.

For **plain-text files** (`title.txt`, `mission.txt`): translate the
natural-language prose only; leave any HTML tags, markdown, code, proper nouns, and
object-of-study material unchanged.

Output only the translated content — **no markdown fences**, no commentary. A
translated `.html` file must be valid HTML that can replace the original verbatim.
The reader stamps text direction and `lang` from the Edition, so never add
`dir`/`lang` or other direction markup — just translate the text.
