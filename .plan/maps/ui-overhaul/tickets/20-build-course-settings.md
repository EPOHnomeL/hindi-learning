---
type: task
blocked_by: [18, 19]
---
# Build the reorganised course settings

> `/wayfinder .plan/maps/ui-overhaul/tickets/20-build-course-settings.md`

## Question

Ship ticket 18's layout holding ticket 17's control set. It follows 19 rather than
running beside it, because both surfaces read `content.reader.courseHeader` and share
the primitives 19 collapses.

Use `/tdd` and `/ponytail`.

## Todo

- [ ] Build the layout, with the mission field and save affordance as 18 settled them.
- [ ] Keep all three entry points working: reader, dashboard, and the Editor's
      Details-only view.
- [ ] `ConfirmDialog` from `ui.tsx`, not another bespoke one.
- [ ] Owner checks stay server-side; existing message namespaces; tenant theming
      intact.
- [ ] `pnpm typecheck` green, and a test covering the Editor's Details-only view.
- [ ] Walk it at phone width from both the reader and the dashboard.

## Done when

Every box above is ticked and the Answer records the browser walk from both entry
points.
