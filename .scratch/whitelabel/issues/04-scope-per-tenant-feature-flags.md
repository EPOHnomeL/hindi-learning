# whitelabel/04: Scope per-tenant feature flags

**Status:** open
**Depends on:** 02
**Labels:** wayfinder:grilling

Child of [Whitelabel map](00-whitelabel-map.md).

## Why

"Each with different features on and off": one tenant may want certificates and translations,
another a bare reader; the marketplace/payments rail should exist on some sites and not
others. That needs a flag set on the tenant record and — critically — **backend enforcement**,
not just hidden buttons: every flaggable feature has Convex functions a client could still
call.

## Questions to answer

- Flag inventory: walk the feature surface and mark what's plausibly toggleable —
  certificates/emblems, translations & Editions, sharing/invites, Public links, seeding new
  Topics vs. read-only catalogue, marketplace/payments, Q&A (questions/replies), Routine
  on-demand fire, and (future) rich-media/video courses. Which are v1 flags for the four
  tenants vs. hardwired-on?
- Flag shape: flat booleans on the tenant record vs. named plans/presets? (Four known tenants
  argues for flat booleans + ponytail; note what a plan abstraction would buy later.)
- **Enforcement seam**: UI gating via a tenant context/hook is easy — where does backend
  gating live? The auth seam (`getOwnedTopic`/`getViewableTopic` in
  [`convex/lib.ts`](../../../convex/lib.ts)) resolves the Topic; does it also resolve the
  tenant + flags, so a disabled feature's mutations reject server-side? What's the pattern for
  flag-gated HTTP routes and the Routine?
- Interaction with existing grants: a Share/Certificate earned while a feature was on, then
  the flag turns off — revoked, frozen, or read-only? Define the general rule once.
- Defaults & drift: new flag added later — default on or off for existing tenants?

## Out of scope

- The tenant record/resolution itself (02).
- The flag-management UI — no longer deferred outright: the user wants an operator dashboard,
  scoped in [ticket 06](06-scope-operator-whitelabel-dashboard.md). This ticket decides the flag
  *shape and enforcement*; 06 decides how the operator edits it.

## Deliverable

The v1 flag inventory as a table (flag × four tenants), the enforcement-seam decision with one
worked example (e.g. `certificates` off end-to-end), and the flag-off-after-grant rule.
