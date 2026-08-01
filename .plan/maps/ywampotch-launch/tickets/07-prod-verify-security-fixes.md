---
type: task
blocked_by: []
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

## Answer

**Both checks passed on prod, 2026-08-01. No failures, so no follow-up tickets.**
The 2026-07-28 tenant-admin authorization batch did not over-tighten and the
`courseAssignment` pool leak is closed server-side.

**Check 1 — sys admin retains full Admin-panel function.** The operator walked all
five tabs on `ywampotch.my-course.app` as sys admin: Allowlist, Sales, Payouts,
Tenants, Generation. All render with content and their live actions work. The
characteristic risk of a tightening pass — a tab that silently goes empty or throws
where it used to have content — did not materialise on any of the five.

**Check 2 — `courseAssignment` returns a tenant admin an empty pool.** Read from the
**response payload**, not the UI, as the ticket demanded. Convex runs over a
WebSocket, so this is *not* visible as an XHR: it was read in Firefox DevTools →
Network → WS → the `sync` socket → Messages, filtered on `available`, expanding the
`Transition` frame's `QueryUpdated` value. Signed in as a **tenant admin** on the
tenant host, the frame carried:

```
"assigned":[Dutch, Finish (Suomi), Growing your relationship with the Holy Spirit,
            Russian, TPM Course, Venda]   (6 rows, titles + topicIds)
"available":[]
```

Note for anyone re-running this: the ticket's wording ("carries no `available`
array") is imprecise and the imprecision matters. `available` is **always present**
in the return shape — it's declared in the validator at `convex/tenants.ts:424`. The
gate at `convex/tenants.ts:432` makes it **empty**, not absent, so `"available":[]`
is the pass and a present key is not itself the leak. Titles inside it would be.

**One residual, recorded rather than papered over.** `available: []` is *consistent
with* the gate working but is not independently *proof* of it, because an empty
untenanted pool would produce the same bytes for any caller. The discriminating
read — the same query as **sys admin**, which should return a non-empty pool — was
not performed, and prod's catalogue is heavily tenanted (six of the visible courses
belong to this one tenant), so the pool may genuinely be empty. What makes the pass
sound anyway: the gate is a plain ternary on `isCallerAdmin(ctx)` with no branch
that could return the pool to a tenant admin, and the UI corroborates independently
(a tenant admin gets the assigned list read-only — no add picker, no Remove). If a
future session wants certainty, unassign one course from a tenant so the pool is
non-empty, then read the query as both accounts.

**Ride-along outcome.** All six of the whitelabel map's outstanding UI checks passed
in the same sitting — 11, 13, 19, 20, 22, 24 — which was the *whole* of its
"UI/browser check pending" list. Recorded on the
[whitelabel map](../../whitelabel/map.md) itself (`ae579ca`), where that map keeps
its verification record, rather than duplicated into its six ticket files. Its
remaining gaps are 18 (cross-host canonical redirect, never verified either way) and
23 (legacy course backfill, an operator decision, not a browser check).
[Ticket 01's](01-brand-continuity-through-the-funnel.md) brand check was **not**
performed and is still owed — it is that ticket's criterion, never this one's.

