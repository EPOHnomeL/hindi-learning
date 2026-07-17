# whitelabel/08: Scope-aware admin roles

**Status:** done (2026-07-17)
**Depends on:** [07](07-tenant-schema-and-seed.md)
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[ADR 0021 draft](../adr-0021-draft-tenant-subdomain-model.md) §4.

## Why

Today's `isCallerAdmin` ([`convex/whitelist.ts:63`](../../../convex/whitelist.ts)) is global-only
— it answers "is this the one Admin" and nothing else. This ADR retires that one-Admin
invariant (**supersede ADR 0011**) in favour of sys admin + per-tenant admins. The dashboard
(19–22) cannot be scope-gated until this lands.

## Scope

- `whitelist.tenantSlug?` (added in 07) encodes scope: absent + `isAdmin: true` = **sys admin**
  (global reach); present + `isAdmin: true` = **tenant admin** (that tenant only); no `isAdmin` =
  member.
- Change `isCallerAdmin` to `isCallerAdmin(ctx, tenantSlug?: string)`:
  - No `tenantSlug` arg → true only for a sys admin (matches every existing call site's meaning
    today — `convex/routine.ts` and `convex/content.ts` keep calling it unscoped, unchanged
    behaviour).
  - `tenantSlug` given → true for a sys admin, **or** a tenant admin whose own `tenantSlug`
    matches the given one.
- Multiple tenant admins per tenant allowed (no cap) — the existing "refuses to remove the one
  Admin row" guard in `AllowlistManager`/`removeEmail` was written for the one-Admin invariant;
  update it so a **sys admin** row still can't be removed if it's the *only* sys admin (an
  equivalent invariant, now scoped), while tenant-admin rows can be freely added/removed as long
  as the sys admin tier keeps at least one row.
- Sign-up admission check: a user signing up under `<slug>.my-course.app` must have a matching
  `whitelist` row with that `tenantSlug` (or no `tenantSlug`, i.e. an existing default-site
  allowlist entry — decide at implementation whether default-site allowlist entries also admit
  tenant subdomains; default to **no**, an entry admits exactly the host it was added under,
  matching "one account → one tenant").
- `docs/adr/0021-*.md`: promote the draft, mark ADR 0011 superseded.

## Acceptance criteria

- `isCallerAdmin(ctx)` (no arg) still returns true only for the sys admin(s) — existing
  Routine/content admin gates are unaffected.
- `isCallerAdmin(ctx, "ywampotch")` returns true for the sys admin and for any `ywampotch`
  tenant admin, false for a `upf` tenant admin or a plain member.
- The "can't remove the last admin" guard still blocks removing the last **sys admin** row, but
  allows removing/adding tenant-admin rows freely.
- ADR 0021 is promoted to `docs/adr/0021-tenant-subdomain-model.md`; ADR 0011 is marked
  superseded (not deleted).

## Resolution (2026-07-17)

Built test-first (`convex/whitelist.test.ts`, +4 tests). Kept deliberately small
(ponytail) — the auth-gate core only, not the sign-up plumbing.

- **`isCallerAdmin(ctx, tenantSlug?)`** ([convex/whitelist.ts](../../../convex/whitelist.ts)) —
  now scope-aware. Row shape decides the role: `isAdmin` + no `tenantSlug` = **sys
  admin** (passes every check, scoped or not); `isAdmin` + `tenantSlug` = **tenant
  admin** (passes only a matching scoped check, never an unscoped/sys-level one).
  No-arg semantics are unchanged from before ("is sys admin"), so every existing
  caller (`content`, `ledger`, `market`, `routine`, `sellers`) is unaffected — the
  acceptance criterion #1 that mattered most.
- **`amITenantAdmin({ tenantSlug })`** — a new query exposing the scoped check for a
  tenant dashboard's route guard. Added *alongside* `amIAdmin` (left `args: {}`)
  rather than overloading it, so the ~4 existing no-arg `useQuery(api.whitelist.amIAdmin)`
  sites don't churn.
- **Last-sys-admin guard** — `removeEmail` now refuses to drop a sys-admin row only
  when it's the *last* one; tenant-admin and member rows are freely removable. The
  old "refuses the Admin's own row" test still passes (a lone sys admin).
- **`seedEmail` / `admitEmail`** gained an optional `tenantSlug` so tenant-admin (and
  tenant-member) rows are bootstrappable from the CLI / tests. `addEmail` stays
  sys-admin-gated and default-site-only (tenant-admin-facing Allowlist editing is
  dashboard work, 19–22).
- **ADRs** — the draft graduated to
  [docs/adr/0022-tenant-subdomain-model.md](../../../docs/adr/0022-tenant-subdomain-model.md)
  (not 0021: that number was taken by the open-sign-up ADR in the interim). ADR 0011's
  banner now records the one-Admin-invariant supersession.

**Deferred (flagged in ADR 0022 §4, not in this issue's acceptance criteria):** the
sign-up host→`users.tenantSlug` stamping (threads the request host through the
`createOrUpdateUser` auth callback) and the tenant-admin-facing Allowlist editing UI.
No current gate depends on either; both belong to the dashboard chain (19–22).
