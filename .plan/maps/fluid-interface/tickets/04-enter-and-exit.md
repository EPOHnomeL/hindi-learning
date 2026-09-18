---
type: task
blocked_by: []
---
# Dialogs, sheets, menus and toasts arrive and leave along one path

> `/wayfinder .plan/maps/fluid-interface/tickets/04-enter-and-exit.md`

## Question

`Modal` (`ui.tsx:111`) hard-cuts in and out with its scrim. The bottom `Sheet`
(`manage/shared.tsx:48`) appears from nowhere instead of rising. `Menu` enters
with `pop-in` scaled from its own centre, not its trigger, and unmounts
instantly. The drawer scrim pops while the sheet slides. `InstallSheet`, the
`ManageShell` toast and the `ArtifactView` copied toast have no motion at all.

Give each an enter and a matching exit: the dialog materialises (opacity plus a
small scale, backdrop fading with it) using `@starting-style` and
`transition-behavior: allow-discrete` on the native `<dialog>`; the sheet rises
and falls; the menu scales from `transform-origin: top right` (its trigger) and
reverses on close; toasts rise in and sink out. Keep `Modal` the one `<dialog>`
(`ui.test.ts` asserts it). Only `transform` and `opacity` move.

## Done when

Each surface named has a visible enter and a mirrored exit, none uses a layout
property, `ui.test.ts` still passes, typecheck passes.

## Answer

Built 2026-09-18, commit `b0a2533`. Verified by typecheck and `ui.test.ts`;
not walked in a browser. `@starting-style` and `transition-behavior:
allow-discrete` need Chromium 117+, Safari 17.5+, Firefox 129+; older browsers
get the old hard cut, nothing breaks.

- The native dialog transitions opacity and `scale(0.96)` to rest over 200ms,
  its backdrop fading with it, with `@starting-style` for the enter and
  `allow-discrete` on `display` and `overlay` so `close()` animates out. The
  ArtifactView prose editor, the documented second dialog, inherits it.
- The bottom `Sheet` adds `.sheet-shell`, which under the `sm` width swaps the
  scale for `translateY(100%)` from `bottom center`, so it rises and falls.
- `Menu` scales from `top end` (its trigger) and closes through `.pop-out`, the
  reverse of `.pop-in`, staying mounted until `animationend`.
- Both toasts and `InstallSheet` share a 14-line `useExit(shown)` hook: mounted
  follows `shown` up at once and down on `animationend`, with a 300ms timeout
  fallback so nothing can stick.
- Under reduced motion every enter and exit becomes a 150ms opacity fade, kept
  as an animation so `animationend` still fires.

The drawer scrim was handled in ticket 03, where it follows the sheet's
position instead of mounting and unmounting.
