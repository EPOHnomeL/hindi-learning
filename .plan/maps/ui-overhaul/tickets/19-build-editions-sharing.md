---
type: task
blocked_by: [16, 17]
---
# Build the reorganised sharing surface

> `/wayfinder .plan/maps/ui-overhaul/tickets/19-build-editions-sharing.md`

## Question

Ship what tickets 15, 16 and 17 decided. Those three Answers are the contract; there
is no separate spec. This is presentation plus the moves 17 assigned. Every query and
mutation stays as it is, and a rail retired from the UI keeps its backend.

Use `/tdd` and `/ponytail`.

## Todo

- [ ] Split `Editions.tsx` (2023 lines, 21 components) along the seams ticket 16
      named. This is also the Editions half of ticket 06.
- [ ] Render ticket 15's three groups: Who can find it, Who you hand it to, What it
      costs.
- [ ] Build the merged voucher card with the distribution mode picker, each mode
      stating its billing and its identity consequence in a line.
- [ ] Collapse the four bespoke confirm dialogs in this file onto `ConfirmDialog` in
      `ui.tsx`.
- [ ] Move the controls ticket 17 reassigned, and make anything sent to `/settings`
      reachable there.
- [ ] Run `convex:convex-authz` over everything that moved. Owner checks stay
      server-side; a move must not widen who can call it.
- [ ] All copy through the existing `Editions` and `CourseSettings` message
      namespaces. No hardcoded English.
- [ ] Keep tenant theming expressible (ADR 0022).
- [ ] Add the CONTEXT.md edit ticket 15 assigned: "one code each" and "one shared
      code" onto the Avoid lists of the Bulk Vouchers and Organisation Voucher
      entries.
- [ ] `pnpm typecheck` green, tests covering the moved controls' authorisation.
- [ ] Walk it in a browser on a real course at phone width.

## Done when

Every box above is ticked and the Answer records that it was walked in a browser at
phone width rather than only read.
