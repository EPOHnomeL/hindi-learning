# course-publishing/11: Per-tenant `selling` flag

**Status:** ready-for-agent
**Depends on:** —
**Labels:** ready-for-agent
**Loop:** `/tdd` (test-first) + `/ponytail`

Child of [Course-publishing PRD](PRD.md). Ground truth: [ticket 02](02-per-tenant-selling-flag.md),
[ticket 04](04-default-site-vs-tenant-scope.md) §3.

## Why

"Selling enabled for that tenant" is a **per-tenant flag** over the single existing platform PayFast
rail. This is whitelabel issue 04's reserved "Marketplace/payments" flag row becoming real — a sixth
`tenants.flags` boolean, composed with (not replacing) the deployment-wide `sellingEnabled()`.

## Scope — the migration (widen → migrate → narrow)

`selling` is a **required** boolean added to `tenantFlagsValidator` (`convex/schema.ts:33`), but four
existing `tenants` rows don't carry it, so a straight push would fail validation. Follow the repo's
one-shot-migration pattern (a secret-gated mutation driven by a `scripts/*.ts`, as in
`scripts/tenant-course-backfill.ts` / `backfill-*.ts`):

1. **Widen** — add `selling: v.optional(v.boolean())` to `tenantFlagsValidator`; push.
2. **Backfill** — a secret-gated migration mutation + `scripts/backfill-selling.ts`
   (`pnpm ...` + `:prod`) that patches every `tenants` row missing `flags.selling` to `false`.
   Idempotent (skip rows that already have it). We do **not** retro-grant `true` to tenants with
   existing priced listings — surfacing that as a conscious operator choice (ticket 02).
3. **Narrow** — change to `selling: v.boolean()` (required); push. Update `seedTenant`'s flags arg /
   validator and `scripts/seed-tenants.ts` fixtures to include `selling: false`.

Reference the `convex-migration-helper` skill for the widen-migrate-narrow mechanics if useful.

## Scope — enforcement

Add the gate at both money mutations (composes with the existing `sellingEnabled()` env check —
**both** must pass to sell):

- **`setEditionPrice`** (`market.ts:39`) — `assertTenantFlag(ctx, topic.tenantSlug, "selling")` after
  the ownership resolve. The real gate: no listing can be created for a non-selling tenant.
- **`startCheckout`** (`market.ts:386`) — same call after resolving the topic, so flipping `selling`
  off stops **new purchases** of an already-priced Edition, not just new pricing.

**No change to `assertTenantFlag`** (`lib.ts:138`) — it already returns early (pass) when
`tenantSlug === undefined`, which is exactly ticket 04's "default-site implicitly on": a default-site
course (no slug) satisfies the per-tenant gate and defers to `sellingEnabled()`. A tenant slug with a
`selling: false` row is denied; a slug with no `tenants` row stays fail-closed (unchanged).

**Flag-off = frozen, not revoked** (verify with tests, don't add code for it — it's emergent):

| Path | Gated? | Off behaviour |
|---|---|---|
| `setEditionPrice` | yes | can't set/change a price |
| `startCheckout` | yes | no new purchases |
| `clearEditionPrice` (`market.ts:83`) | **no** (leave un-gated) | owner can always un-price → free |
| existing `entitlements` (read path) | never gated | keep access forever |
| the `listings` row | not deleted | frozen, persists |

The owner's "set a price" UI affordance already keys off the flag delivered via `getTheme`'s `flags` —
hidden when off, no new client plumbing.

## Tests (write first)

- Backfill sets `false` on rows missing it, skips rows that have it (idempotent).
- `setEditionPrice` / `startCheckout` throw for a tenant whose `selling` is `false`; succeed when
  `true` (with `sellingEnabled()` true).
- Default-site course (`tenantSlug` undefined) sells whenever `sellingEnabled()` is true, regardless of
  any flag.
- `clearEditionPrice` still works on a `selling: false` tenant; an existing entitlement still reads.

## Acceptance criteria

- Push succeeds through all three migration steps; the four tenant rows carry `selling: false`;
  running the backfill twice doesn't change anything.
- `seedTenant` / `seed-tenants` create rows with `selling: false`.
- The enforcement tests pass; no existing marketplace test regresses.

**Unblocks:** 14 (the catalogue's Buy affordance reflects buyability).
