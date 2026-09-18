---
type: task
blocked_by: []
---
# Controls answer on press, not on release

> `/wayfinder .plan/maps/fluid-interface/tickets/02-press-feedback.md`

## Question

Fourteen `active:` rules against 266 `hover:`. The shared primitives in
`ui.tsx` (`IconButton`, `MenuItem`, the confirm buttons) have no press state, the
tab bar recolours only by route, and the narration play button scales on hover
only. On a phone the press is the only feedback the device can give.

Give every interactive primitive an instant press state on pointer-down: a
`scale(0.97)` or a `bg-hi` fill with a transition near 100ms out and none in.
Cover `ui.tsx`, `AppTabs.tsx`, `NavItem.tsx`, the narration dock button and the
buttons in `InstallSheet.tsx`, `SettingsDialog.tsx`, `SettingsPage.tsx` and
`CheckoutPage.tsx`. Prefer one shared class or a base rule in `globals.css`
over 200 utility edits.

## Done when

Every button and link-styled control in the files named shows a visible change
on `:active`; hover-only feedback remains only on hover-capable pointers;
typecheck passes.

## Answer

Built 2026-09-18, commit `b0a2533`. Verified by typecheck and tests; not
walked in a browser.

One base rule in `globals.css` covers every `button`, `[role="button"]`,
`[role="menuitem"]` and `.press` element that is not disabled or `.no-press`:
`transform: scale(0.97)` with zero transition on the way in and a 100ms
ease-out on release. It uses `transform`, not the `scale` property, so
Tailwind's translate and rotate utilities compose with it. `.press` goes on
link-shaped controls (IconButton links, tabs, nav rows); `.no-press` opts out
anything that scales itself, such as the narration play button, which now has
its own `active:scale-95` under `motion-safe`. The shared primitives, confirm
buttons, tabs, nav rows and install-sheet buttons also got a `bg-hi` or
`accent/80` fill on press. Under reduced motion the transform is dropped and
an inset tint stands in, so accent-filled buttons keep a legible label.

Two title buttons in the readers had their own `active:scale-98`, which
compounded with the base rule; those utilities were removed in `15f454b`.

Not changed: controls elsewhere that keep `transition-colors` get the instant
press but snap back on release, because that utility does not transition
transform. A sweep to `transition duration-100` is cheap if the snap shows.
