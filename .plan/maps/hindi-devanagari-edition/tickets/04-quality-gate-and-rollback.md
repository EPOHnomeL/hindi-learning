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
