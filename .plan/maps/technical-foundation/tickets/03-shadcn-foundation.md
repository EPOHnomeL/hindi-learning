---
type: task
blocked_by: [02]
---

# Shadcn/ui foundation (reconciled with the existing design system)

## Question

**Where it stands:** open — shadcn/ui not installed; UI is hand-rolled Tailwind v4 primitives (ui.tsx)

Vocabulary: [`CONTEXT.md`](../../../../CONTEXT.md). Spec: `../../internal-course-studio/PRD.md`. Respects [ADR 0011](../../../../docs/adr/0011-app-driven-theme-into-sandboxed-lesson-iframe.md) (app → iframe theme bridge).

## What to build

Adopt **shadcn/ui** on the existing Tailwind v4 setup and **reconcile** it with the current design system rather than overriding it: the `@theme` palette (warm paper / dark ink / rust accent) and the Spectral + Noto Serif Devanagari fonts stay authoritative; shadcn components inherit them. Prove the integration end-to-end on **one** representative surface without regressing dark mode or the app→iframe theme bridge.

## Acceptance criteria

- [ ] shadcn/ui is installed and configured against Tailwind v4 and the existing `globals.css` `@theme` tokens — no competing/parallel palette.
- [ ] Spectral (serif/headings) + Noto Serif Devanagari remain the type system; shadcn components inherit them.
- [ ] One representative surface (sign-in form or a reused dialog) is rebuilt with shadcn as the proof of integration.
- [ ] The dark-mode toggle still works on the rebuilt surface; the iframe theme bridge (ADR 0011) is unregressed.
- [ ] A short note records the token-reconciliation approach for the chrome restyle (`internal-course-studio/05`) to follow.

## Blocked by

[02, does the lesson body and the quiz come out of the iframe](02-lesson-quiz-architecture.md). **Corrected 2026-09-01:** this ticket said "None, can start immediately" while it lived in `internal-course-studio`, where the iframe question was not on the map. It is now, and it decides whether the component set must include quiz primitives, so building the foundation first risks a set that cannot reach the product’s highest-traffic surface.

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding as written: no shadcn/radix/cva/tailwind-merge in package.json, no components.json, no components/ui/; the UI remains hand-rolled primitives in ui.tsx. Worth noting: the chrome restyle (internal-course-studio issue 05) shipped deliberately on those hand-rolled primitives, so this may be a `wontfix` candidate — owner's call.

## Done when

shadcn/ui is installed against the existing Tailwind v4 `@theme` tokens with one surface rebuilt as proof, dark mode and the ADR 0011 iframe theme bridge unregressed, and the reconciliation approach written down for the chrome restyle to follow.

<!-- Migrated 2026-07-30 from GitHub issue #76 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
<!-- Some links in this ticket were de-linked in the 2026-07-30 migration: their targets
     (.scratch PRDs, already-resolved sibling tickets, the retired product-direction
     roadmap) do not exist in the repo. The names are kept as prose for provenance. -->

<!-- Moved 2026-09-01 from `internal-course-studio/04` into the technical-foundation map, which groups this repo’s scalability, refactoring and code-architecture work. Renumbered to 03 because `blocked_by` is map-local and the old numbers collided. Inbound links across `.plan/` were repointed in the same commit. -->
