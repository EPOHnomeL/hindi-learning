---
type: task
blocked_by: []
---
# Tenant schema & seed

## Question

Every other issue in this effort reads or writes the `tenants` table or a `tenantSlug` field —
this is the foundation; no other implementation issue can start without it. Ground truth: ADR
0021 §1–2, 03 (theme shape), 04 (flags shape). Scope:

- Add the `tenants` table to `convex/schema.ts` (`slug`, `displayName`, `theme` object {light
  required record, dark optional, logo/favicon optional storage ids}, `flags` object {certificates,
  translations, publicLinks, qa, seeding booleans}, index `by_slug`).
- Add `tenantSlug: v.optional(v.string())` to `topics` (+ index `by_tenant`), `users`, `whitelist`.
  Existing rows untouched — absent `tenantSlug` is the safe default, no backfill.
- Validate `theme.light`/`theme.dark` keys against 09's `src/design/tokens.ts` in code (the Convex
  validator stays a loose `v.record` per 03 — hyphenated names like `good-b` don't fit `v.object`).
- A seed script (existing `scripts/*.ts` pattern, plain + `:prod`) inserting the four tenant rows
  with 03's mock palettes and all five flags `true` (04's v1-migration default). Idempotent.
- Seeding tenant **admins** is out — an operator action with real emails, via 08's mutations.

## Done when

`npx convex codegen`/typecheck passes with the new schema; the seed script creates exactly the
four fixture rows on dev and running it twice doesn't duplicate; no existing
`topics`/`users`/`whitelist` row is modified.

## Answer

Built test-first (2026-07-16, `/tdd` + `/ponytail`). **Seam:** `api.tenants.seedTenant`
(secret-gated public mutation the seed script drives) — six `convex/tenants.test.ts` cases lock
creation, per-slug idempotency (skip, never overwrite), the token-key contract, and the secret guard.

- **Schema** (`convex/schema.ts`): `tenants` table (`by_slug`); `tenantSlug?` on `topics`
  (+ `by_tenant`), `users`, `whitelist`. Shared `tenantThemeValidator` / `tenantFlagsValidator`
  exported for reuse. `users` inlined from `authTables` (all original fields + email/phone indexes
  preserved) to carry the new field.
- **Mutation** (`convex/tenants.ts`): `seedTenant` upserts one tenant idempotently.
  `TENANT_THEME_TOKENS` + `assertThemeTokens` enforce the 14-key contract in code (light complete,
  dark partial). *ponytail:* Convex can't import `src/`, so the token list mirrors 09's future
  `src/design/tokens.ts` — keep in sync when 09 lands.
- **Seed** (`scripts/seed-tenants.ts`, `pnpm seed-tenants[:prod]`): the four fixtures inline;
  `yknot` carries a partial dark palette.

**Verified on dev:** typecheck clean; seed created exactly 4 rows (14 light tokens each, dark on
`yknot` only, all flags true); second run skipped all four. Full suite green (the one failing
`bundle-authoring-assets` test is a pre-existing CRLF artifact, untouched). Tenant *admin*
assignment deferred to 08. **Unblocks 08, 10, 12, 14, 15, 17, 18, 23.**
