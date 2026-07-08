# 05 — Chrome restyle + brand + mobile polish

Status: done — chrome/brand/mobile restyled (26a69f8, 4664ad0, 8c1e813), on hand-rolled primitives rather than shadcn

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md). Spec: [`../PRD.md`](../PRD.md). Respects [ADR 0011](../../../docs/adr/0011-app-driven-theme-into-sandboxed-lesson-iframe.md) (theme bridge).

## What to build

Restyle the product **chrome** on the shadcn foundation so the app reads as a finished product to executives: the dashboard, course shell, sign-in, Seed/upload forms, and admin panel. Apply a cohesive **brand** (name/wordmark, colour usage, empty and loading states) and tighten **mobile** for the dashboard/authoring chrome. The reader and lesson artifacts are already styled — preserve them and dark mode.

## Acceptance criteria

- [ ] Dashboard, course shell, sign-in, Seed/upload modals, and admin panel are restyled cohesively on the shadcn foundation.
- [ ] A cohesive brand is applied: wordmark, colour usage, and considered empty/loading states.
- [ ] The dashboard and authoring chrome are usable on mobile (not desktop-only); the reader remains mobile-first.
- [ ] Dark mode works across all restyled surfaces and inside lesson iframes (ADR 0011 unregressed).
- [ ] No regression to lesson artifact rendering or the quiz/capture widgets.

## Blocked by

- Issue **04** (shadcn foundation).

## Notes

- The final product **name** is a pending product decision. Build on a placeholder wordmark; swapping it later must be a one-place change, not a sweep.
