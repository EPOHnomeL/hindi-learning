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

## Not yet specified

- **Inherited defects of the source Edition** — the conversion pass can only be as good as
  `hi-Latn`, and `hi-Latn` has known holes: in the eval sample the John 16:13 scripture
  block was left in **English**, untranslated
  ([hi-Latn.packet.md](../../../topics/prophetic-school/eval/judge/hi-Latn.packet.md)).
  A converter told to change script would faithfully carry that English into the
  Devanagari Edition. Whether the pass repairs such holes, flags them, or ships them is a
  real call, but how many there are isn't known yet. clears-with: 02

## Out of scope

- **Every other topic**, and every other `-Latn` → native-script pair. prophetic-school is
  the proof; generalising is a fresh effort if the proof holds.
- **An owner-facing "derive Devanagari" affordance** in the Editions panel. A one-shot
  admin script was chosen deliberately; productising it is not on this route.
- **Re-translating English → Hindi** through the existing pipeline. Highest quality and
  full token cost — the thing this effort exists to avoid.
