# internal-course-studio/04: shadcn/ui foundation (reconciled with the existing design system)

**Status:** open — shadcn/ui not installed; UI is hand-rolled Tailwind v4 primitives (ui.tsx)
**Depends on:** — (none, can start immediately)
**Imported:** from GitHub #26 on 2026-07-15 (created 2026-07-10; GitHub issue deleted after import)

> Migrated from [`.scratch/internal-course-studio/issues/04-shadcn-foundation.md`](https://github.com/EPOHnomeL/hindi-learning/blob/93ad1e399b426e882c40d9422d8691e1dfb3a46b/.scratch/internal-course-studio/issues/04-shadcn-foundation.md) on 2026-07-10. Relative links in the text resolve against that file's location.

## Why

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md). Spec: [`../PRD.md`](../PRD.md). Respects [ADR 0011](../../../docs/adr/0011-app-driven-theme-into-sandboxed-lesson-iframe.md) (app → iframe theme bridge).

## Scope

Adopt **shadcn/ui** on the existing Tailwind v4 setup and **reconcile** it with the current design system rather than overriding it: the `@theme` palette (warm paper / dark ink / rust accent) and the Spectral + Noto Serif Devanagari fonts stay authoritative; shadcn components inherit them. Prove the integration end-to-end on **one** representative surface without regressing dark mode or the app→iframe theme bridge.

## Acceptance criteria

- [ ] shadcn/ui is installed and configured against Tailwind v4 and the existing `globals.css` `@theme` tokens — no competing/parallel palette.
- [ ] Spectral (serif/headings) + Noto Serif Devanagari remain the type system; shadcn components inherit them.
- [ ] One representative surface (sign-in form or a reused dialog) is rebuilt with shadcn as the proof of integration.
- [ ] The dark-mode toggle still works on the rebuilt surface; the iframe theme bridge (ADR 0011) is unregressed.
- [ ] A short note records the token-reconciliation approach for the chrome restyle (issue 05) to follow.

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding as written: no shadcn/radix/cva/tailwind-merge in package.json, no components.json, no components/ui/; the UI remains hand-rolled primitives in ui.tsx. Worth noting: the chrome restyle (internal-course-studio issue 05) shipped deliberately on those hand-rolled primitives, so this may be a `wontfix` candidate — owner's call.
