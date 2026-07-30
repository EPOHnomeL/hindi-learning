# Internal course studio

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A course an owner can build privately and then deliberately release: a draft/published
visibility state, a share entry point gated on it, real per-run cost numbers, and a UI
foundation the rest of the studio can be built on.

## Notes

- **Ticket 01 is the spine** — nothing distributes until reader-visibility exists. Ticket 02
  is blocked on it; that edge is wired in the frontmatter.
- **Prefactor instruction in ticket 01, worth honouring:** route all Viewer/Guest content
  reads through a **single** query path so the visibility filter lands in exactly one place.
  A per-surface filter is the bug factory here.
- **This is visibility, never editing** — ADR 0003 keeps Lessons immutable. Note the overlap
  with [course-authoring/01](../course-authoring/tickets/01-ai-assisted-course-editing.md),
  which also proposes a draft/review gate, from the authoring side. **One gate, not two** —
  reconcile before building either.
- Ticket 03 (cost instrumentation) is **measurement only** — no billing, no enforcement. It
  is also the prerequisite the funding decision in
  [paid-marketplace/01](../paid-marketplace/tickets/01-authoring-cost-and-model-provider-strategy.md)
  is explicitly waiting on, and the data
  [authoring-efficiency/01](../authoring-efficiency/tickets/01-streamline-routine-effort.md)
  needs to prove a saving. It unblocks two other maps — take it early.
- Ticket 04 **reconciles** shadcn/ui with the existing design system rather than overriding
  it: the warm-paper/dark-ink/rust `@theme` palette and Spectral + Noto Serif Devanagari stay
  authoritative. ADR 0011's app→iframe theme bridge must not regress.
- Skills: `/tdd`, `convex:convex-expert`, `vercel:shadcn` (ticket 04).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **The chrome restyle** that ticket 04 says its reconciliation note is *for*. Filed as a
  successor there but not yet a ticket here; graduates once 04 lands.

## Out of scope

- Metering or billing on top of the usage numbers — measurement only here.
