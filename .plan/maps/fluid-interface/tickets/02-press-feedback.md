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
