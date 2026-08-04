# Hindi (Devanagari) Edition from the romanized one

<!-- Charted 2026-08-02. The map is an INDEX, not a store — each decision lives in its
     own ticket; the map gists it and links. -->

## Destination

A spec sharp enough that **one** session builds and runs a one-shot script which stands
up the `hi` (Devanagari) Edition of **prophetic-school** from its existing `hi-Latn`
Edition — by a cheap AI *script-conversion* pass, not a fresh English→Hindi translate run.
The map ends at `spec.md`; it does not run the script.

## Notes

**Plan only.** This map decides; a later pipeline session builds. No build tickets here.

Four things were settled with the user while charting, before any ticket existed:

- **Cheap AI conversion, not a rule-based script.** The user's opening ask was "a script,
  few tokens". Verified against the real corpus and rejected: the `hi-Latn` Edition is
  *informal Hinglish*, not ITRANS/IAST/Harvard-Kyoto, so it is not mechanically
  invertible — `t/d/n` don't distinguish dental from retroflex, `i/ee` and `u/oo` are used
  inconsistently, aspiration is dropped, nukta is absent (`jad` → जड़ or जद?), and schwa
  deletion isn't recoverable. A regex/dictionary pass yields Devanagari that is
  consistently *misspelled*, which for a Devanagari reader is worse than no Edition. A
  conversion-only prompt on a cheap model is still far below a translate run's cost.
- **Naturalize while converting** — not letter-faithful. `Sabak 1 · Sunna Seekhna` becomes
  पाठ 1 · सुनना सीखना, not सबक 1 · सुनना सीखना. The model may pick the Devanagari-idiomatic
  word where the romanized one is colloquial or Urdu-leaning. This is the harder call to
  verify and it shapes both the prompt (02) and the quality gate (04).
- **prophetic-school only**, as a proof. Other topics and other `-Latn` pairs are out of scope.
- **A one-shot script against prod**, not a Convex action and not a UI affordance.

Settled with the user on **2026-08-02, after 01 and 02 had already resolved**, and it
supersedes part of both:

- **No paid API calls. The converter is the Claude Code harness itself.** The user's words:
  *"That costs money. Rather use claude locally on my laptop here in claude code — I want you
  as my claude code harness to translate it from latin → devanagari."* So 01's model/client/cost
  question is moot ($0), and 02 was re-run and re-graded through this harness — which turned
  out to be the better converter as well as the free one. The ban is scoped to **this effort**;
  prod's English→X translate path stays on `gemini-3.5-flash`, untouched.
- The consequence: **"a script" now means a script that moves content and checks it, with the
  conversion done in-session between the pulls and the pushes.** Per lesson that is only ~7 K
  in / ~6 K out tokens, so the Edition fans out — one subagent per lesson, ~10 concurrent,
  **10–20 minutes for all 59 in one session**. The binding constraint is context, not time:
  the orchestrating session must never read the converted documents back. That is 03's.

**The conversion half of the build already ran, on 2026-08-02, ahead of the spec.** An
out-of-band session (driven by a temp `HANDOFF-devanagari-conversion.md`, gitignored) converted
all **59 items** — 56 lessons + glossary to HTML, plus title and mission as plain strings — with
this harness as the converter. 57/57 HTML items pass `check.ts`'s full acceptance battery
(tag-for-tag fidelity, quiz `data-answer`/`data-alt` byte-identity, placeholder/entity counts,
`swapBackStatic` round-trip); 17 first-pass failures were each re-run through a *fresh* subagent,
never hand-patched. Output and scripts live at `topics/_devanagari/` — **gitignored and
uncommitted** (`.gitignore:49` ignores all of `topics/`), so it is machine-local and one `clean`
away from gone. Nothing was written to prod: no `publishTranslation`, no `cloneEdition`, no `.env`
touched. This does **not** make the map a build map — 03, 04 and 06 are still undecided, and the
destination is still `spec.md`. It does mean those three now have real artifacts to reason from
rather than estimates: 06 can *count* the inherited English instead of guessing, and 03's point 6
(fan-out and context discipline) has been walked once in practice.

Verified in the tree while charting, so no ticket need re-derive it:

- **"Call it hindi" is already done.** `hi` is in the picker as `Hindi` / `हिन्दी`
  ([convex/languages.ts:40](../../../convex/languages.ts#L40)) beside `hi-Latn` as
  `Hindi (Latin Alphabet)` ([convex/languages.ts:134](../../../convex/languages.ts#L134)).
  Nothing to rename. `isDevanagari("hi")` is true, so the reader already serves it the
  Noto Devanagari webfont; `messages/hi.json` chrome is already Devanagari.
- **The plumbing exists.** `cloneEdition`
  ([convex/translate.ts:409](../../../convex/translate.ts#L409)) is an admin seam that
  stands up a new Edition from an existing one — copies `translations` rows verbatim,
  inserts a `ready` `translationJobs` row, copies `shares`/`pendingShares`. It refuses if
  the target Edition already has a job, and refuses if the source isn't `ready`. The
  missing piece is only the conversion pass over the cloned rows.
- Skills: `convex:convex-expert`, `/prototype` (02), `/grilling` (03, 04), `/ponytail`.

## Decisions so far

<!-- one line per resolved ticket -->

- [Which model, through which existing client, and what does one Edition cost?](tickets/01-conversion-model-client-and-cost.md)
  — **superseded the same day: there is no model and no API cost.** It first picked
  `gemini-3.1-flash-lite` via `geminiComplete` from a `pnpm tsx` script (~$1/Edition); the user
  then ruled out paid API calls and the converter became the Claude Code harness itself. What
  survives: the corpus numbers, the guards, and the finding that the in-Convex `translateTopic`
  path **structurally cannot** read `hi-Latn`, so the write path is `readEditionBodies` → disk
  → `publishTranslation`.
- [Does a naturalizing conversion prompt actually hold up on a real lesson?](tickets/02-does-naturalizing-conversion-hold.md)
  — **It holds, converted by this Claude Code harness.** Proven on the real stored prod row and
  graded against a Gemini run of the same input: exact on every counted structural property
  (402/402 tags, 436/436 text nodes, all attribute counts, quiz guard, static-block round-trip)
  where Gemini had one instability, and it **repaired the source's untranslated English** where
  Gemini shipped it. Chunk = **one whole `swapOutStatic`-stripped lesson**. Three
  carry-forwards: scripture is snapped to the published HHBD wording *deliberately*
  ([translate.ts:773](../../../convex/translate.ts#L773)); `data-answer`/`data-alt` must stay
  Latin or quiz 4 breaks; and the run **fans out one subagent per lesson** with the parent
  never reading the output back — 10–20 minutes for the Edition, and 03's to design.
- [The English the source never translated: repair it, flag it, or ship it?](tickets/06-inherited-english-repair-flag-or-ship.md)
  — **Repair, all of it, including the answer keys.** Counted on the converted output (the source is
  romanized, so English is unmeasurable there): **15,126 user-visible Latin words** remain across 57
  items — 6,720 in the `<footer>` citation block, 6,329 in prose/chrome, 1,595 in the `data-ok`/
  `data-no` quiz feedback the learner is shown, 482 in fill-in quiz quotes — and it is **not a closed
  set** (1,120 of 1,646 runs are single-file; 349 runs are ≥6 words), so no find-and-replace table
  does it. Proper nouns and cited-work titles stay Latin; everything else converts. Two supersessions
  of 02: "`data-answer` must stay Latin or quiz 4 breaks" is **wrong** — `norm()` lowercases, a no-op
  on Devanagari — but `norm()` never normalizes and the output holds 4,513 *decomposed* nukta
  sequences, so converting answer keys needs a one-line `.normalize('NFC')` in `foot.html`; and the
  real guard against attribute edits is `check.ts`'s **tag-for-tag** comparison, not the
  `data-answer` count check 02 named, so that comparison has to be relaxed to mask quiz-attribute
  values. The pipeline defect went to its own effort.

## Not yet specified

<!-- The "Inherited defects" patch graduated on 2026-08-02 when 02 resolved; it lives on as
     ticket 06. Nothing else is in the fog — the route to the spec is fully ticketed. -->

- ~~**Inherited defects of the source Edition**~~ — graduated into
  [The English the source never translated: repair it, flag it, or ship it?](tickets/06-inherited-english-repair-flag-or-ship.md).

## Out of scope

- **Every other topic**, and every other `-Latn` → native-script pair. prophetic-school is
  the proof; generalising is a fresh effort if the proof holds.
- **An owner-facing "derive Devanagari" affordance** in the Editions panel. A one-shot
  admin script was chosen deliberately; productising it is not on this route.
- **Re-translating English → Hindi** through the existing pipeline. Highest quality and
  full token cost — the thing this effort exists to avoid.
