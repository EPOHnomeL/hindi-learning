---
type: grilling
blocked_by: [02]
---
# How do we know the Edition is fit to read, and how do we pull it if it isn't?

> `/wayfinder .plan/maps/hindi-devanagari-edition/tickets/04-quality-gate-and-rollback.md`

## Question

Naturalizing conversion was chosen over letter-faithful conversion knowing it is much harder to
verify: you cannot diff word-for-word against the romanized source, because changing words is
the point. So the gate has to be designed, not assumed.

- **Who or what judges it?** This repo already has a blind multi-model judging harness
  (`topics/prophetic-school/eval/`, `docs/translation-model-trial.md`) that produced the `hi-Latn`
  verdict. Does it apply here, does it need a conversion-specific rubric, or is a human read of a
  sample the honest gate? Nobody on this project necessarily reads Devanagari — say so if that's
  the binding constraint, and what follows from it.
- **What's the sample?** One lesson, all ten, or a spot-check pattern.
- **Mechanical checks worth automating** before any judgement: no Latin-script Hindi left, no
  untranslated English outside genuine proper nouns, markup identical to the source's structure,
  row count matches, no empty bodies.
- **The rollback.** The Edition lands in prod. If the read is bad, what removes it cleanly —
  `translations` rows, the `translationJobs` row, copied `shares` — and does that path exist or
  need writing? A copied share means a real viewer may already hold the bad Edition.
- **The gate's position.** Does the script write to prod and then get judged, or is there a
  dry-run that produces output for judgement before anything is written?

## Done when

A named gate with a named judge, a defined sample, the list of mechanical checks, and a rollback
procedure that is either shown to exist or specified as work. States explicitly whether the
Edition is published/visible before or after the gate passes.

## Answer

**The gate is the owner's own read, after publication.** Settled with the user on 2026-08-04, who
said plainly: *"lets just publish it, i will go through it and see what is wrong."*

- **Who judges it.** The Topic owner, reading the live Edition. The ticket asked whether a human
  read is "the honest gate" given that nobody on the project necessarily reads Devanagari — the
  answer is that the owner does, and no automated judge was used. The blind multi-model harness at
  `topics/prophetic-school/eval/` was **not** applied: it was built to rank *translations of
  English*, and this is a script conversion of an existing Hindi Edition, so its rubric doesn't
  transfer without being rewritten. That rewrite was not worth doing for a gate a human was
  willing to perform.
- **The sample is everything**, by the owner's choice — they read the Edition, not a spot-check.
- **Mechanical checks, and what they actually proved.** Run before publish: tag-for-tag structural
  fidelity, entity/attribute counts, `swapBackStatic` round-trip, `quizStructureMatches`. Run after
  publish against prod (`verify.ts`): 59 rows, `emptyBodies=0`, `blobBacked=0`,
  `romanizedTitles=0`, 497,569 Devanagari characters. **What they do not prove** is that the Hindi
  reads well — that is exactly what the owner's read is for. The harness was extended with two new
  gates (Latin residue outside a declared whitelist, and `norm()` answer-key answerability) at
  [assets/03-check-harness-relaxed.ts](../assets/03-check-harness-relaxed.ts), but they were
  **written and never enforced**, because the repair they were built to verify was dropped.
- **The gate's position: after.** The Edition was published and reported `ready` *before* any
  quality read. This is a deliberate reversal of the ticket's preferred ordering, and the honest
  cost is that **2 copied shares** mean real viewers can reach it now, holding the 15,074
  user-visible English words that [06](06-inherited-english-repair-flag-or-ship.md) decided to
  repair and that were then not repaired.
- **The rollback exists and is safe.** `removeEdition`
  ([translate.ts:363](../../../convex/translate.ts#L363)) deletes the `translations` rows, the
  `translationJobs` row, `publicLinks`, and the copied `shares`/`pendingShares`. It never touches
  `_storage`, so tearing `hi` down cannot harm `hi-Latn` even though the cloned rows briefly
  pointed at its blobs. **It requires owner auth, not the admin secret** — so the rollback is
  performed by the signed-in owner in the app, and is not available to the publish script. No new
  code needs writing for it.
