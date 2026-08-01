---
type: task
blocked_by: []
---

# Backfill anchor ids into existing References

## Question

**Depends on:** 01 — card anchor contract
**Domain:** [[Reference]] (CONTEXT.md)

## Why deferred

Per the product decision (2026-07-19), reference-card deep-links + share ship for **new courses
only**. Existing References authored before the 01 contract have `.term` cards with no ids, so they
get no anchors and no share icons — a graceful, silent degradation, not a bug. Retrofitting them is
explicitly a **separate todo**, not part of the first cut.

## What a future build would do

- Walk existing References and inject `id="<slug>"` (+ a `.def` wrapper) into each `.term`, using
  the same slug rule as 01, keyed off the source (English) term so the id is language-stable.
- Decide the mechanism: a one-off migration over stored Reference HTML blobs vs. lazily on next
  edit/republish. References are mutable (ADR 0003) and re-authored over time, so a chunk may
  self-heal simply by being revised — measure how much backfill is actually needed before writing a
  migration.
- Handle references whose entries aren't clean `.term` cards (older/freeform shapes) — likely skip
  rather than guess.

## Blocked on

- 01–03 shipped and the contract settled, so the backfill targets a stable shape.
- Evidence it's worth it (how many live References predate the contract, how often they're re-edited).

## Done when

A decision on whether the backfill is worth doing at all, measured against how many live References predate the anchor contract and how often they are re-edited — and if it is, the mechanism (one-off migration vs self-heal on next republish).

<!-- Migrated 2026-07-30 from GitHub issue #87 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
<!-- Some links in this ticket were de-linked in the 2026-07-30 migration: their targets
     (.scratch PRDs, already-resolved sibling tickets, the retired product-direction
     roadmap) do not exist in the repo. The names are kept as prose for provenance. -->

---

## Context folded from the retired `reference-cards` map (2026-08-01)

<!-- was .plan/maps/reader-experience/tickets/04-backfill-existing-references.md; that single-ticket map was consolidated into reader-experience. Tickets 01–03 of the original reference-cards effort shipped; their numbers are retired, and ticket 04's stated dependency on the 01 anchor contract is satisfied. -->

- **Deferred on purpose, by product decision (2026-07-19):** reference-card deep-links and
  share ship for **new courses only**. Older References have `.term` cards with no ids, so
  they get no anchors and no share icons. That is **graceful silent degradation, not a bug** —
  do not treat this as a defect queue.
- **This may correctly resolve as "don't".** References are mutable (ADR 0003) and re-authored
  over time, so a chunk of them may self-heal simply by being revised. **Measure how much
  backfill is actually needed before writing a migration** — that measurement is the first
  real piece of work here.
- Older freeform References that are not clean `.term` cards should likely be skipped rather
  than guessed at.
- Skills: `/ponytail` (the laziest correct answer may be to do nothing),
  `convex:convex-migration-helper` if a migration does turn out to be warranted.
- **Out of scope:** the anchor contract, deep-links, and share icons themselves — all shipped.
