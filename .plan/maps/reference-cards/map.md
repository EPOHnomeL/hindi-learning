# Reference cards backfill

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A decision — evidence-first — on whether existing References get anchor ids retrofitted at
all, and if so by what mechanism.

## Notes

- **Deferred on purpose, by product decision (2026-07-19):** reference-card deep-links and
  share ship for **new courses only**. Older References have `.term` cards with no ids, so
  they get no anchors and no share icons. That is **graceful silent degradation, not a bug** —
  do not treat this map as a defect queue.
- **Tickets 01–03 of this effort already shipped** and are not present as files; ticket 04's
  stated dependency on the 01 anchor contract is satisfied. Numbering starts at 04 because
  `NN` is a permanent identity.
- **The map may correctly resolve as "don't".** References are mutable (ADR 0003) and
  re-authored over time, so a chunk of them may self-heal simply by being revised. **Measure
  how much backfill is actually needed before writing a migration** — that measurement is the
  first real piece of work here.
- Older freeform References that are not clean `.term` cards should likely be skipped rather
  than guessed at.
- Skills: `/ponytail` (the laziest correct answer may be to do nothing),
  `convex:convex-migration-helper` if a migration does turn out to be warranted.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

## Out of scope

- The anchor contract, deep-links, and share icons themselves — all shipped.
