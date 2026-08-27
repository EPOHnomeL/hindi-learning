---
type: grilling
blocked_by: [02]
---
# Design foundation: tokens, components, tenant theming

> `/wayfinder .plan/maps/ui-overhaul/tickets/03-design-foundation.md`

## Question

The root cause of "looks amateur" is hand-rolled Tailwind with no shared system.
`src/design/tokens.ts` carries colour only, which is why radii are typed by hand
(`rounded-[10px]`, `rounded-[11px]`, `rounded-xl`) with no rule. Decide the
foundation every surface redesign consumes:

- **Library or own it.** shadcn/ui is the obvious candidate on this stack, against
  formalising the hand-rolled `ui.tsx` set. Pick one.
- **The token set**: typography scale, spacing, colour roles, radii, elevation.
- **Whitelabel**: how per-tenant branding maps onto those tokens. The foundation must
  keep tenant theming expressible rather than fight it.
- **The direction**, chosen against Mobbin references for learning apps.

## Done when

The foundation is named precisely enough that a per-surface redesign ticket can be
written and worked without reopening any of these four.
