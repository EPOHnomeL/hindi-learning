# course-publishing/02: Per-tenant `selling` flag

**Status:** open
**Depends on:** —
**Labels:** wayfinder:grilling

Child of [Course publishing map](00-course-publishing-map.md).

## Question

The user pinned "selling enabled for that tenant" as a **per-tenant flag only** — the money still
flows on the single existing platform PayFast rail (`sellingEnabled()`, deployment-wide env). This
ticket decides the flag's shape and enforcement, via `/grilling`:

1. **Where it lives** — slot into the whitelabel issue-04 flags model (flat required booleans on the
   `tenants` row: `certificates`, `translations`, `publicLinks`, `qa`, `seeding`). Issue 04 already
   reserved "Marketplace/payments" as a *future* row; this is that row becoming real. Name it
   (`selling`?).
2. **Default value** — issue 04's going-forward policy is that a flag added *after* the v1 migration
   defaults `false` (opt-in per tenant). Confirm `selling` defaults `false` (no tenant sells until
   the operator opts them in), and that this needs a migration adding the field to existing rows.
3. **What it gates** — presumably the owner's "set a price" affordance for courses under that tenant,
   *and* checkout for that tenant's priced Editions (mirroring issue-04's `assertTenantFlag` pattern
   at the gated mutation — `setEditionPrice`, `startCheckout`). Confirm it composes with, not
   replaces, the deployment-wide `sellingEnabled()` (both must be true to sell). Decide the flag-off
   behaviour for an Edition already priced (frozen vs. blocked — mirror issue-04's "frozen, not
   revoked" rule).

Independent of the enroll mechanic (ticket 01) — a free self-enroll works whether or not a tenant can
sell. Resolve, comment, close, add a Decisions-so-far line to the map.
