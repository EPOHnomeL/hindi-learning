# ywampotch-launch/07: Prod-verify the security fixes

**Status:** open

## Why

The 2026-07-28 tenant-admin authorization batch closed **5 confirmed privilege
holes** and tightened **11 gates**. It shipped green and **nobody has checked it
on a live account**. That surface now carries real buyers, real Entitlements and
real money.

Note the precedent: `catalogue.list` also shipped fully green and was broken in
production, because its tests seeded a row shape no production path can write.
Green tests are not evidence that a live account behaves.

## Scope

Two checks on **prod**, against real accounts. Minutes of work.

1. **A sys admin still has full Admin-panel function.** The characteristic risk
   of a tightening pass is over-tightening — silently losing the operator's own
   surface. Walk every tab: Allowlist, Sales, Payouts, Tenants, Generation.
2. **As a tenant admin, the `courseAssignment` response carries no `available`
   array** of other users' course titles. Check the **response payload**, not the
   rendered UI — the point is that the leak is closed server-side and not merely
   hidden by a component that stopped rendering it.

## Out of scope

- A full re-audit of all 11 gates. If either check fails, that becomes its own
  ticket with real scope.
- Any code change. This ticket is verification; a failure is a finding.

## Acceptance criteria

- Both checks performed on prod, against real accounts, with the outcome written
  down — here, in this file, under a `## Result` heading.
- Any failure filed as its own ticket rather than fixed inline, so the fix gets
  tests.

## Notes

Real tenant and user accounts exist **only on prod**; dev holds two operator
accounts (`docs/agents/project-context.md`). Verifying against dev would prove
nothing about the accounts that matter.

**Ride-along, not scope.** This is the only planned session with a human on prod
against a real tenant host, and the closed whitelabel map has six tickets whose
UI check needs exactly that
([whitelabel map § Verification still outstanding](../../whitelabel/issues/00-whitelabel-map.md)),
plus [ticket 01's](01-brand-continuity-through-the-funnel.md) brand check. Clearing
them in the same sitting is free; they are **not** acceptance criteria for this
ticket and a failure in one of them does not block it.
