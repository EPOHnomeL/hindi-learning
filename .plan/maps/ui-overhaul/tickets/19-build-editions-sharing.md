---
type: task
blocked_by: [16, 17]
---
# Build the reorganised sharing surface

> `/wayfinder .plan/maps/ui-overhaul/tickets/19-build-editions-sharing.md`

## Question

Ship what tickets 15, 16 and 17 decided. Those three Answers are the contract, and
there is no separate spec.

`Editions.tsx` is 2023 lines and 21 components in one file. It splits along the seams
ticket 16 named, which is also the Editions half of ticket 06. Every query and
mutation it calls stays as it is: this is a presentation change, plus the moves ticket
17 assigned and the rails ticket 15 retired from view. A rail retired from the UI keeps
its backend.

Constraints that are not up for renegotiation here:

- Owner-only checks stay server-side. Run `convex:convex-authz` over anything that
  moved.
- All copy goes through the existing `Editions` and `CourseSettings` message
  namespaces. No hardcoded English, since the app ships more than one app language.
- Tenant theming stays expressible. The app is whitelabeled per ADR 0022.
- Four bespoke confirm dialogs live in this file while `ConfirmDialog` exists in
  `ui.tsx`. They collapse onto it.

Use `/tdd` and `/ponytail`. Walk it in a browser on a real course before resolving.

## Done when

The surface is built, `pnpm typecheck` is green, tests cover the moved controls'
authorisation, and the Answer records that it was walked in a browser at phone width
rather than only read. Any control ticket 17 sent to `/settings` is reachable there.
