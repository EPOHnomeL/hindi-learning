# whitelabel/01: Scope Claude design system integration (tokens + components)

**Status:** open
**Depends on:** —

## Why

The UI-redesign prototype (hosted Claude Artifact, 2026-07-06) was wired into React piecemeal:
`icons.tsx` (inline-SVG icon set), `ui.tsx` (IconButton/Dialog/Menu/ConfirmDialog),
`CourseSettings.tsx`, `Editions.tsx`, plus ad-hoc tokens in `globals.css` (e.g.
`--color-danger`). "Properly integrating" means promoting that from a pile of components into
a **tokenised design system** — which is also the load-bearing prerequisite for whitelabel:
a tenant theme (ticket 03) should be nothing more than a token override.

## Questions to answer

- Token inventory: what's currently hardcoded across `globals.css` and component styles
  (colors, typography, spacing, radii, shadows)? Define the canonical token set and naming.
- Component coverage: which surfaces still bypass the system (Landing, Certificate print view,
  reader chrome, dashboard remnants)? List the gaps; decide which are in the integration pass.
- **The lesson-blob problem**: lesson HTML is wrapped with a shared head/stylesheet at publish
  and stored as an immutable blob. If the design system (or later a tenant theme) changes,
  published lessons don't. Options: inject the stylesheet at render time in the reader instead
  of baking it in at publish; version the wrapped head; accept drift. This decision shapes
  ticket 03 — take a position here.
- Dark mode / print: are they token dimensions from day one or explicitly out?
- Where does the system live — stay as `src/app/_components/` + `globals.css`, or a dedicated
  `src/design/` module with a documented contract the teach-skill AUTHORING assets also
  reference?
- The prototype artifact remains the design source of truth until wiring is done — what's the
  sync story between artifact and code after this pass (or does the code become canonical)?

## Out of scope

- Any per-tenant theming (ticket 03) — this ticket makes theming *possible*, single-brand.
- Redesigning flows; visual decisions were already agreed in the prototype.

## Deliverable

Token set + component inventory (have/gap), the lesson-blob styling decision, and an ordered
integration plan for the implementation tickets.
