# course-publishing/02: Per-tenant `selling` flag

**Status:** done
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

## Resolution (2026-07-18, `/grilling`)

The per-tenant selling capability is a **sixth `tenants.flags` boolean named `selling`**, gating the
owner's pricing at the mutation boundary, composed with — not replacing — the deployment-wide
`sellingEnabled()` env gate. Both must be true to sell.

1. **Name & home** — `selling`, added to `tenantFlagsValidator`
   ([convex/schema.ts:33](../../../convex/schema.ts#L33)) as a **required** boolean alongside
   `certificates`, `translations`, `publicLinks`, `qa`, `seeding`. This is whitelabel issue 04's
   reserved "Marketplace/payments" row becoming real. Because the validator is required (not
   optional), a **migration must backfill the field onto every existing `tenants` row**.

2. **Default `false` everywhere** — backfill all four existing tenants to `false`, and default the
   seed/create path to `false`. No tenant sells until an operator opts it in (issue 04's post-v1
   opt-in policy). We did **not** retro-grant `true` to tenants with existing priced listings —
   surfacing that as a conscious operator choice rather than an auto-migration.

3. **Gates both mutations** — add `assertTenantFlag(ctx, topic.tenantSlug, "selling")`
   ([convex/lib.ts:138](../../../convex/lib.ts#L138)) inline at:
   - **`setEditionPrice`** ([convex/market.ts:39](../../../convex/market.ts#L39)) — the real gate; no
     price can be created for a non-selling tenant.
   - **`startCheckout`** ([convex/market.ts:386](../../../convex/market.ts#L386)) — so flipping
     `selling` off genuinely stops *new purchases* of an already-priced Edition, not just new pricing.

   The owner's "set a price" UI affordance keys off the same flag (already delivered to the client via
   `getTheme`'s `flags`) — hidden when off, no new plumbing.

4. **Flag-off = frozen, not revoked** (with one deliberate deviation from issue 04's CREATE-only
   rule, chosen by gating `startCheckout`):

   | Path | Gated by `selling`? | Result when off |
   |---|---|---|
   | `setEditionPrice` | yes | can't set/change a price |
   | `startCheckout` | yes | no new purchases |
   | `clearEditionPrice` ([market.ts:83](../../../convex/market.ts#L83)) | **no** | owner can always un-price → course becomes free |
   | existing `entitlements` | n/a (read path never gated) | keep access forever |
   | the `listings` row | not deleted | frozen — persists in the DB |

   `clearEditionPrice` is left **un-gated**, matching the existing `sellingEnabled()` precedent ("an
   owner can always un-list, even if their can-sell grant later lapsed"), so an owner in a
   switched-off tenant can convert a stuck priced course to free rather than being frozen out.

**Hand-off (not decided here):** a **default-site** course has `tenantSlug` undefined, so
`assertTenantFlag` returns early → `selling` is *implicitly on* there. How default-site selling is
gated (or ruled out) is owned by [ticket 04](04-default-site-vs-tenant-scope.md) point 3 — flagged,
not pre-empted.

**Unblocks:** [ticket 03 — Define the "publish" action](03-define-publish-action.md) (its other
dependency, ticket 01, is already closed).
