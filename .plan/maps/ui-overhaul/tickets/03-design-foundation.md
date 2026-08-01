---
type: grilling
blocked_by: [02]
---
# Design foundation — tokens, components, tenant theming

> `/wayfinder .plan/maps/ui-overhaul/tickets/03-design-foundation.md`

## Question

The root cause of "looks amateur" is hand-rolled Tailwind with no shared system.
Decide the foundation every surface redesign will consume:

- Adopt a component library (shadcn/ui is the obvious candidate on this stack) or
  formalise the hand-rolled components into an owned set?
- The token set: typography scale, spacing, color roles, radii, elevation.
- How **per-tenant whitelabel branding** maps onto those tokens — the foundation
  must keep tenant theming expressible, not fight it.
- The overall design direction, chosen against Mobbin references for learning apps.

## Done when

The foundation is named precisely enough that a per-surface redesign ticket can be
written and worked without reopening any of these choices.
