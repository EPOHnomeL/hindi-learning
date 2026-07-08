# 04 — shadcn/ui foundation (reconciled with the existing design system)

Status: open — shadcn/ui not installed; UI is hand-rolled Tailwind v4 primitives (ui.tsx)

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md). Spec: [`../PRD.md`](../PRD.md). Respects [ADR 0011](../../../docs/adr/0011-app-driven-theme-into-sandboxed-lesson-iframe.md) (app → iframe theme bridge).

## What to build

Adopt **shadcn/ui** on the existing Tailwind v4 setup and **reconcile** it with the current design system rather than overriding it: the `@theme` palette (warm paper / dark ink / rust accent) and the Spectral + Noto Serif Devanagari fonts stay authoritative; shadcn components inherit them. Prove the integration end-to-end on **one** representative surface without regressing dark mode or the app→iframe theme bridge.

## Acceptance criteria

- [ ] shadcn/ui is installed and configured against Tailwind v4 and the existing `globals.css` `@theme` tokens — no competing/parallel palette.
- [ ] Spectral (serif/headings) + Noto Serif Devanagari remain the type system; shadcn components inherit them.
- [ ] One representative surface (sign-in form or a reused dialog) is rebuilt with shadcn as the proof of integration.
- [ ] The dark-mode toggle still works on the rebuilt surface; the iframe theme bridge (ADR 0011) is unregressed.
- [ ] A short note records the token-reconciliation approach for the chrome restyle (issue 05) to follow.

## Blocked by

None - can start immediately.
