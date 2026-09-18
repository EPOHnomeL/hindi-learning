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
