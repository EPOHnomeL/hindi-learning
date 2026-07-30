---
type: grilling
blocked_by: []
---

# Per-tenant `selling` flag

## Question

The user pinned "selling enabled for that tenant" as a **per-tenant flag only** — the money still
flows on the single existing platform PayFast rail (`sellingEnabled()`, deployment-wide env). This
ticket decides the flag's shape and enforcement, via `/grilling`:

1. **Where it lives** — slot into the whitelabel issue-04 flags model (flat required booleans on the
   `tenants` row: `certificates`, `translations`, `publicLinks`, `qa`, `seeding`). Issue 04 already
   reserved "Marketplace/payments" as a *future* row; this is that row becoming real. Name it
   (`selling`?).
2. **Default value** — issue 04's going-forward policy is that a flag added *after* the v1 migration
   defaults `false` (opt-in per tenant). Confirm `selling` defaults `false`, and that this needs a
   migration adding the field to existing rows.
3. **What it gates** — presumably the owner's "set a price" affordance *and* checkout for that
   tenant's priced Editions (mirroring issue-04's `assertTenantFlag` pattern at `setEditionPrice`,
   `startCheckout`). Confirm it composes with, not replaces, the deployment-wide `sellingEnabled()`
   (both must be true to sell). Decide the flag-off behaviour for an Edition already priced (frozen
   vs. blocked — mirror issue-04's "frozen, not revoked" rule).

Independent of the enroll mechanic (ticket 01) — a free self-enroll works whether or not a tenant can
sell.

## Done when

The flag's name/home, default, migration need, and enforcement points (with flag-off semantics) are
decided and recorded, with a Decisions-so-far line on the map.

## Answer

Resolved 2026-07-18 (`/grilling`). The per-tenant selling capability is a **sixth `tenants.flags`
boolean named `selling`**, gating the owner's pricing at the mutation boundary, composed with — not
replacing — the deployment-wide `sellingEnabled()` env gate. Both must be true to sell.

1. **Name & home** — `selling`, added to `tenantFlagsValidator` (`convex/schema.ts:33`) as a
   **required** boolean alongside `certificates`, `translations`, `publicLinks`, `qa`, `seeding`.
   Because the validator is required, a **migration must backfill the field onto every existing
   `tenants` row**.
2. **Default `false` everywhere** — backfill all four existing tenants to `false`, and default the
   seed/create path to `false`. We did **not** retro-grant `true` to tenants with existing priced
   listings — surfacing that as a conscious operator choice rather than an auto-migration.
3. **Gates both mutations** — `assertTenantFlag(ctx, topic.tenantSlug, "selling")` (`convex/lib.ts:138`)
   inline at **`setEditionPrice`** (`market.ts:39`, the real gate) and **`startCheckout`**
   (`market.ts:386`, so flipping `selling` off stops *new purchases* of an already-priced Edition).
   The owner's "set a price" UI keys off the same flag (delivered via `getTheme`'s `flags`) — hidden
   when off, no new plumbing.
4. **Flag-off = frozen, not revoked** (one deliberate deviation from issue 04's CREATE-only rule, via
   gating `startCheckout`): `setEditionPrice` and `startCheckout` are gated; `clearEditionPrice`
   (`market.ts:83`) is left **un-gated** so an owner in a switched-off tenant can always un-price to
   free; existing `entitlements` keep access forever; the `listings` row is not deleted (frozen).

**Hand-off (not decided here):** a **default-site** course has `tenantSlug` undefined, so
`assertTenantFlag` returns early → `selling` is *implicitly on* there. How default-site selling is
gated is owned by [ticket 04](04-default-site-vs-tenant-scope.md) point 3 — flagged, not pre-empted.

**Unblocks:** [ticket 03](03-define-publish-action.md) (its other dependency, ticket 01, is already
closed).
