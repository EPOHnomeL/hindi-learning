---
type: task
blocked_by: []
---

# Per-tenant `selling` flag

## Question

"Selling enabled for that tenant" is a **per-tenant flag** over the single existing platform PayFast
rail — whitelabel issue 04's reserved "Marketplace/payments" row becoming real, a sixth
`tenants.flags` boolean composed with (not replacing) the deployment-wide `sellingEnabled()`. Ground
truth: [ticket 02](02-per-tenant-selling-flag.md), [ticket 04](04-default-site-vs-tenant-scope.md) §3.

Scope — the migration (widen → migrate → narrow): `selling` is a **required** boolean added to
`tenantFlagsValidator` (`convex/schema.ts:33`), but four existing `tenants` rows don't carry it.
Follow the repo's one-shot-migration pattern (secret-gated mutation driven by a `scripts/*.ts`):
1. **Widen** — add `selling: v.optional(v.boolean())`; push.
2. **Backfill** — a secret-gated migration + `scripts/backfill-selling.ts` (`:prod`) patching every
   `tenants` row missing `flags.selling` to `false`; idempotent (skip rows that have it). Do **not**
   retro-grant `true` to tenants with existing priced listings.
3. **Narrow** — change to `selling: v.boolean()` (required); push. Update `seedTenant` and
   `scripts/seed-tenants.ts` fixtures to include `selling: false`.

Scope — enforcement: add `assertTenantFlag(ctx, topic.tenantSlug, "selling")` at **`setEditionPrice`**
(`market.ts:39`) and **`startCheckout`** (`market.ts:386`), composing with the existing
`sellingEnabled()` env check (both must pass). **No change to `assertTenantFlag`** (`lib.ts:138`) — it
already passes when `tenantSlug === undefined` (ticket 04's "default-site implicitly on"). Flag-off =
**frozen, not revoked** (emergent — verify with tests): `setEditionPrice`/`startCheckout` gated;
`clearEditionPrice` (`market.ts:83`) left un-gated; existing `entitlements` never gated; the
`listings` row not deleted.

Tests (write first): backfill sets `false` on missing rows, skips present ones (idempotent);
`setEditionPrice`/`startCheckout` throw for a `selling: false` tenant, succeed when `true` (with
`sellingEnabled()` true); a default-site course (`tenantSlug` undefined) sells whenever
`sellingEnabled()` is true regardless of any flag; `clearEditionPrice` still works and an existing
entitlement still reads on a `selling: false` tenant.

## Done when

Push succeeds through all three migration steps; the four tenant rows carry `selling: false`; the
backfill is idempotent; `seedTenant`/`seed-tenants` create rows with `selling: false`; the enforcement
tests pass with no marketplace regression.

## Notes

**Not built — still open, independent of the 2026-07-28 build.** The design is fully locked by tickets
02 and 04 §3 (a sixth required `tenants.flags.selling` boolean, default `false`, widen-migrate-narrow,
gated at `setEditionPrice` + `startCheckout` composed with `sellingEnabled()`, flag-off frozen-not-
revoked, default site implicitly on). Both the map's build note and the spec's amendment record this
explicitly as the one moving part **not built and still open** — it did not ship with issues 09/10/12
(GitHub #114–#118) and remains a standalone implementation task whenever an operator needs per-tenant
selling. No decision is outstanding; only the migration + enforcement code is unwritten.

## Answer

**Decided 2026-09-01: this scope now lives at
[tenant-feature-modularity/10](../../tenant-feature-modularity/tickets/10-build-the-selling-switch.md),
and this ticket closes as a transfer. DECIDED, NOT BUILT.** Nothing shipped. The flag
still does not exist, and reading this Answer as "done" would be exactly wrong.

Why the move, and why here rather than a `git mv`:

- `tenant-feature-modularity/10` (Build: the selling switch) **says it absorbs this
  ticket** in its own body, chartered 2026-09-01. Two tickets owning one migration is
  how a money-rail change gets built twice, and that map instructed whoever built it to
  come back and say so here. Saying so is this Answer.
- The design in this ticket's Question is **not superseded**, it is inherited: a sixth
  required `tenants.flags.selling` boolean, default `false`, widen then backfill then
  narrow, gated at `setEditionPrice` and `startCheckout` composed with
  `sellingEnabled()`, `clearEditionPrice` left un-gated, flag-off frozen rather than
  revoked, default site implicitly on. That map's ticket 02 (what "off" does to live
  data) may amend it, and its ticket 01 owns the composed truth table across all three
  gates. Read this Question before building 10; it is the fully-scoped version.
- It stayed a `course-publishing` ticket only because the
  [technical-foundation](../../technical-foundation/map.md) charter of the same morning
  read `course-publishing/14` (Catalogue query) as `blocked_by` this one and did not
  want to orphan the edge. **14 is resolved and shipped** (2026-07-28, ADR 0024), so
  that edge gates nothing. That map's Notes now carry the correction.

The scope was never abandoned and this map's `spec.md` amendment about it still stands
as the record of what was decided. The one moving part is unwritten code, and it is
tracked as an unstarted ticket on the map that owns tenant switches.

<!-- Resolved 2026-09-01 during the .plan consolidation (33 map dirs to 7 active maps),
     as a scope transfer rather than a build. Per the tracker's malformation rule 4,
     decided is not built: this ticket renders Done and tenant-feature-modularity/10
     renders unstarted, and that contrast IS the planned-vs-implemented indicator. -->
