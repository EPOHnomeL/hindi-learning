---
type: task
blocked_by: [01, 02, 08]
---
# The reportData query and its script

## Question

The Routine is an agent, and an agent must not *derive* income figures, only arrange
them (map Out of scope). This ticket is the boundary that makes that true: one
`PUBLISH_SECRET`-guarded query returning exactly the shape the report renders, behind a
`pnpm` script, testable with `vitest` like the rest of the repo.

**Do not extend `sales.report` / `sales.byDay`.** They are `isCallerAdmin`-gated,
return **gross only**, are not tenant-scoped, and `salesOnly` structurally excludes
donations, with a comment warning that "a third money kind must flip this to an
allow-list". This is a **sibling** that reuses their rollup shape. Read them first.

The returned shape, per the settled model:

**Per language** (the roster left-joined with everything derived)
- `lang`, the roster `label`, `displayName`, whether an email exists
- the rung: `rostered | invited | busy | finished`, derived from `pendingShares` /
  `shares` with `role: "translator"` / `publishedEditions` / `listings`
- how long it has been on that rung, from the relevant row's `_creationTime`
- whether the Edition exists at all, and its `translationJobs` state if it does, so the
  page can distinguish "no Edition" from "machine Edition, no human"
- 08's ruling on whether **Finished** needs a machine-only qualifier

**Income** (the tenant's, not the platform's)
- `sellerShare` split **owed** and **paid**, per language, from `ledger.status`
- `gross` totals for the context row
- **donations included** as their own source, with no language
- a **projected** translator share at the tenant's rate, clearly flagged projected and
  never presented as owed, since nothing is frozen onto historical rows until 11

Scope: `prophetic-school` under the YWAM Potch tenant, hardcoded (map Notes). Take the
tenant and slug as arguments anyway, so the second tenant the map's fog anticipates is a
call-site change rather than a rewrite.

## Done when

- One query, secret-guarded, returning the shape above with an explicit `returns`
  validator in the house style.
- `pnpm run translator-status:prod` prints it as JSON, using
  `ConvexHttpClient(convexUrl(true))` and never the Convex CLI (map Notes).
- Tests cover: each rung, a roster row with no Edition, an Edition with no roster row,
  a language with income but no translator, the donation row, and the owed/paid split.
- Verified against prod once, and the Answer records the real numbers seen, so a later
  session can tell a rendering bug from a data change.
- `pnpm typecheck` and `pnpm test` green.

## Ruled out

**Superseded on 2026-09-01 by the course Dashboard tab.** The operator decided the
owner reads all of this in the app, on the Dashboard peer of
`/courses/[slug]/manage`, rather than in a Sunday artifact. A live owner-gated Convex
query read by a React tab replaces a `PUBLISH_SECRET`-guarded query read by an agent,
so the boundary this ticket existed to draw ("an agent must not derive income
figures, only arrange them") is moot: no agent is in the loop.

What survives, and where it went:

- The **owed/paid `sellerShare` shape** is reused verbatim by
  [`ui-overhaul/25`](../../ui-overhaul/tickets/25-dashboard-payout-panel.md), which
  cites this map's settled vocabulary as its default.
- The **per-rung, per-language row shape** is reused by
  [`ui-overhaul/26`](../../ui-overhaul/tickets/26-dashboard-editor-progress-table.md).
- The **test list above** (each rung, roster row with no Edition, Edition with no
  roster row, language with income but no translator, the donation row, the owed/paid
  split) is a good list and both tickets should steal it.

Only the delivery mechanism is dead: the `PUBLISH_SECRET` guard, the `pnpm` script,
and the JSON contract with an agent.
