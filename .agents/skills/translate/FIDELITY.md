# Fidelity — the whole point

These are the rules for translating one file of a course Edition. They are the
contract for every `translate` subagent; read them before you touch the file.

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

**Nothing is left in the source language.** When the run is done, no learner-read
sentence anywhere in the Edition is still in the source language — not a verse, not
a quotation, not a footer, not a caption. "I couldn't find a translation" is never a
reason to ship source-language prose; it only changes *how* you produce the target
text, never *whether* you do.

**Scripture prefers an existing translation.** When the prose quotes the Bible — a
`.verse` block, a cited passage, an epigraph — reach first for the wording of a
widely-used published Bible in the target language and use it **verbatim** (e.g. the
Afrikaanse Bybel for Afrikaans; the Bible Society of India / HHBD Devanagari text for
Hindi), leaving the reference as-is, so the learner meets Scripture in its familiar
published form rather than a back-translation. **If you cannot recall a reliable
published rendering, translate the passage yourself** — plainly, faithfully, in
standard, correctly-spelled words of the target language, matching the register of a
printed Bible — and move on. Do not leave it in the source language, do not gloss it,
and do not flag it in the text. When the source has already pasted the canonical verse
in the target language, treat it as object of study and leave it byte-for-byte.

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

## Working cheaply

You are one file's translator. Every token you spend that is not the translated
file is waste.

- **Read the source once**, write the destination once. Never re-read either file
  to check your work, and never print the translation into your reply.
- **A `<script>` or `<style>` block over ~20 lines is not retyped.** Copy the source
  file to the destination first (`cp`), then use edits to replace the prose in
  place. The markers and code then cannot drift, and you pay tokens only for prose.
  For a mostly-prose file, one straight `Write` of the whole translated file is
  cheaper — pick whichever moves fewer bytes.
- **Do not explain, plan aloud, summarise the lesson, or list what you changed.**
- **Your final reply is exactly one line**: `done <destination filename>`, or
  `failed <destination filename> — <short reason>`. Nothing else.
