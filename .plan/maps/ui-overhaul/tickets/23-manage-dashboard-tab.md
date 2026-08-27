---
type: task
blocked_by: [19]
---
# Build the Dashboard tab on the manage route

> `/wayfinder .plan/maps/ui-overhaul/tickets/23-manage-dashboard-tab.md`

## Question

Ticket 16's shell has four peer tabs; the fourth is Dashboard, course-wide, read-only
stats so an owner can track the course at a glance. The operator scoped it on
2026-08-27: published state, people, editors, editions, price. "At least just that
for now", so nothing beyond those five without asking.

It was decided from prototype D3's summary rail (see
`assets/manage-shell.md`), not prototyped as a tab itself, so its interior layout is
this ticket's to arrange within the shell's one-column body.

Use `/tdd` and `/ponytail`.

## Todo

- [ ] Add the Dashboard tab to the shell ticket 19 ships, with its icon: none of the
      existing `icons.tsx` paths fits, so add one (SVG, never emoji), same stroke
      style as the rest.
- [ ] Render the five stats from queries that already exist where possible; a new
      query needs the owner check server-side.
- [ ] Read-only. No control lives here; each stat may link to the tab that owns it.
- [ ] Copy through the message namespaces, no hardcoded English.
- [ ] `pnpm typecheck` green.
- [ ] Walk it in a browser at phone width.

## Done when

Every box above is ticked and the Answer records that the tab was walked in a browser
at phone width rather than only read.
