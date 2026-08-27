---
type: task
blocked_by: [18, 19]
---
# Build the reorganised course settings

> `/wayfinder .plan/maps/ui-overhaul/tickets/20-build-course-settings.md`

## Question

Ship the layout ticket 18 settled, holding the controls ticket 17 assigned. It follows
ticket 19 rather than running beside it, because both surfaces read from
`content.reader.courseHeader` and share the confirm and dialog primitives that 19
collapses.

Same constraints as 19. Server-side owner checks, existing message namespaces, tenant
theming, and `ConfirmDialog` instead of another bespoke one. The three entry points,
reader, dashboard and Editor, all keep working.

Use `/tdd` and `/ponytail`.

## Done when

Built, `pnpm typecheck` green, the Editor's Details-only view covered by a test, and
the Answer records a browser walk at phone width from both the reader and the
dashboard entry points.
