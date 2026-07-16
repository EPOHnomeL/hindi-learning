# whitelabel/08: Scope-aware admin roles

**Status:** open
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
