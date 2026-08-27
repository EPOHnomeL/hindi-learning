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

**Corrected 2026-08-27.** This ticket claimed three working entry points. There is one:
the owner's dashboard card kebab. Commit `e228ba5` (2026-08-23) removed the reader's door,
leaving the `owner={false}` Details-only branch as dead code. Two things follow, both in
scope here: **Teacher Q&A** moves in from `Editions.tsx` as part of 17's control set, and
the **Editor's Details door returns in the reader**, gated on the per-Edition `canEdit`
`courseHeader` already computes server side (ADR 0020). That revives the existing dead
branch rather than writing a new view, and it is a deliberate partial reversal of the
2026-08-23 drawer trim, so say so in the commit or it reads as drift.

Use `/tdd` and `/ponytail`.

## Todo

- [ ] Build the layout, with the mission field and save affordance as 18 settled them.
- [ ] Move the Teacher Q&A toggle in, and remove it from `Editions.tsx`.
- [ ] Restore the Editor's Details-only door in the reader, where 18 placed it.
- [ ] `ConfirmDialog` from `ui.tsx`, not another bespoke one.
- [ ] Owner checks stay server-side; existing message namespaces; tenant theming
      intact.
- [ ] `pnpm typecheck` green, plus a test that an Editor sees Details and nothing else
      while a stranger sees nothing.
- [ ] Walk it at phone width from the owner's dashboard and from an Editor's reader.

## Done when

Every box above is ticked and the Answer records both browser walks.
