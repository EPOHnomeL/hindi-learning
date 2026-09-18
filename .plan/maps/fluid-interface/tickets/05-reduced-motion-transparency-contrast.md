---
type: task
blocked_by: [02, 03, 04, 06]
claimed_by: fable-t3code-e63c30e8
claimed_at: 2026-09-18T11:44:20+02:00
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
