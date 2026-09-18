---
type: task
blocked_by: [02, 03, 04, 06]
---
# The chrome honours reduced motion, reduced transparency and more contrast

> `/wayfinder .plan/maps/fluid-interface/tickets/05-reduced-motion-transparency-contrast.md`

## Question

Every keyframe in `globals.css` is gated on `prefers-reduced-motion`; no
Tailwind transition is. The sliding header and tab bar, the drawer, the
`transition-[top]` and `transition-[bottom]` bars and every `transition-[width]`
progress fill all keep moving. There are zero rules for
`prefers-reduced-transparency` and `prefers-contrast`.

Sweep every `transition-*` and `duration-*` in `src/app` after tickets 02, 03,
04 and 06 have landed: under reduced motion a slide becomes a short opacity
cross-fade and a spring jumps; under reduced transparency the translucent chrome
goes solid and drops its blur; under `prefers-contrast: more` floating surfaces
get a defined `border-ink` edge. Prefer Tailwind's `motion-reduce:` variant and
two small media blocks in `globals.css` over per-file rules.

## Done when

`grep` finds no `transition-[top]`, `transition-[bottom]` or `transition-[width]`
in `src/app`; every remaining transform transition has a `motion-reduce`
fallback; both new media queries exist in `globals.css`; typecheck passes.

## Answer

Built 2026-09-18, commit `bb66b7d`. Verified by typecheck and the `src` suite;
not walked in a browser, and no one has toggled the three OS preferences
against it.

- Inventory after: 27 `transition-transform` hits, zero `transition-[width]`,
  `[top]` or `[bottom]`. Every hit carries a `motion-reduce:` variant. The
  three bars that actually leave the screen (both reader headers, the tab bar)
  cross-fade instead of sliding; the sticky title bars and the dock, which only
  reposition, jump; chevrons and toggle knobs jump.
- All six progress fills (dashboard, sharing, narration dock, setup bar) moved
  from animating `width` to `scaleX` on a full-width inner div with a start
  origin. The setup bar's sheen rides the scaled fill unchanged. Fills lost
  their own `rounded-full` because a scaled radius squashes; the tracks still
  clip them round.
- One `globals.css` block stops `animate-pulse` and `animate-ping` under reduced
  motion instead of forty utility edits. `prefers-contrast: more` now inks the
  dialog border as well as the chrome hairline from ticket 06. Reduced
  transparency was already covered by `.chrome`.
- The lesson iframe's deep-link `card-flash` becomes a held gold outline and
  highlight under reduced motion, in the reference-card CSS block where the
  class lives, so the target stays findable.

The spring in ticket 03 already jumps under reduced motion, so nothing here
touched `useSheetDrag`.
