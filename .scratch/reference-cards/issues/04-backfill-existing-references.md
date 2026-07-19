# reference-cards/04: Backfill anchor ids into existing References

**Status:** deferred (parked — do NOT build with 01–03)
**Labels:** wontfix-for-now
**Depends on:** [01 — card anchor contract](01-card-anchor-contract.md)
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
</content>
