---
type: task
blocked_by: []
claimed_by: wayfinder-07-prod-verify
claimed_at: 2026-08-01T14:02:00+02:00
---

# Prod-verify the security fixes

## Question

The 2026-07-28 tenant-admin authorization batch closed **5 confirmed privilege
holes** and tightened **11 gates**. It shipped green and **nobody has checked it
on a live account**. That surface now carries real buyers, real Entitlements and
real money. Precedent: `catalogue.list` also shipped fully green and was broken
in production because its tests seeded a row shape no production path can write —
green tests are not evidence that a live account behaves.

Two checks on **prod**, against real accounts (minutes of work):

1. **A sys admin still has full Admin-panel function.** The characteristic risk
   of a tightening pass is over-tightening — silently losing the operator's own
   surface. Walk every tab: Allowlist, Sales, Payouts, Tenants, Generation.
2. **As a tenant admin, the `courseAssignment` response carries no `available`
   array** of other users' course titles. Check the **response payload**, not the
   rendered UI — the point is that the leak is closed server-side and not merely
   hidden by a component that stopped rendering it.

Out of scope: a full re-audit of all 11 gates (if either check fails, that
becomes its own ticket with real scope); any code change — this ticket is
verification, a failure is a finding.

Real tenant and user accounts exist **only on prod**; dev holds two operator
accounts, so verifying against dev would prove nothing.

**Ride-along, not scope.** This is the only planned session with a human on prod
against a real tenant host, and the closed whitelabel map has six tickets whose
UI check needs exactly that
([whitelabel map § Verification still outstanding](../../whitelabel/map.md)),
plus [ticket 01's](01-brand-continuity-through-the-funnel.md) brand check.
Clearing them in the same sitting is free; they are **not** acceptance criteria
here and a failure in one of them does not block this ticket.

## Done when

Both checks are performed on prod against real accounts, with the outcome written
down; and any failure is filed as its own ticket rather than fixed inline, so the
fix gets tests.

