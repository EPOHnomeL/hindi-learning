# whitelabel/07: Tenant schema & seed

**Status:** done (2026-07-16, `/tdd` + `/ponytail`)
**Depends on:** —
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[ADR 0021 draft](../adr-0021-draft-tenant-subdomain-model.md) §1–2,
[03](03-scope-per-tenant-theming.md) (theme shape), [04](04-scope-per-tenant-feature-flags.md)
(flags shape).

## Why

Every other issue in this effort reads or writes the `tenants` table or a `tenantSlug` field.
This is the foundation: no other implementation issue can start without it.

## Scope

Add to `convex/schema.ts`:

```ts
tenants: defineTable({
  slug: v.string(),
  displayName: v.string(),
  theme: v.object({
    light: v.record(v.string(), v.string()),
    dark:  v.optional(v.record(v.string(), v.string())),
    logo:    v.optional(v.id("_storage")),
    favicon: v.optional(v.id("_storage")),
  }),
  flags: v.object({
    certificates: v.boolean(),
    translations: v.boolean(),
    publicLinks:  v.boolean(),
    qa:           v.boolean(),
    seeding:      v.boolean(),
  }),
}).index("by_slug", ["slug"]),
```

- Add `tenantSlug: v.optional(v.string())` to `topics` (+ `.index("by_tenant", ["tenantSlug"])`),
  `users`, and `whitelist`. Existing rows are untouched — `tenantSlug` absent is the safe default
  (default site / sys-admin scope), no backfill needed.
- Validate `theme.light`/`theme.dark` keys against the token list in
  [09](09-design-token-contract-cleanup.md)'s `src/design/tokens.ts` in code (the Convex validator
  is a loose `v.record(v.string(), v.string())` per 03's decision — CSS-friendly hyphenated names
  like `good-b` don't fit a fixed `v.object`).
- A seed script (follow the existing `scripts/*.ts` pattern, plain + `:prod` variants) that
  inserts the four tenant rows — `upf`, `ywampotch`, `almighty-warriors`, `yknot` — using the mock
  palettes from [03](03-scope-per-tenant-theming.md)'s acceptance fixture, and all five flags
  `true` (04's v1-migration default: no regression from today's always-on behaviour). Idempotent
  (skip a slug that already exists).
- Seeding tenant **admins** (marking specific `whitelist` rows with `tenantSlug`) is an operator
  action with real email addresses, not something to invent here — leave the seed script to
  create tenant rows only; admin assignment happens via [08](08-scope-aware-admin-roles.md)'s
  mutations, run by the operator once real tenant-admin emails are known.

## Acceptance criteria

- `npx convex codegen` (or equivalent typecheck) passes with the new schema.
- Seed script run against dev creates exactly the four tenant rows with the fixture data; running
  it twice doesn't duplicate rows.
- No existing `topics`/`users`/`whitelist` row is modified by this issue.

## Resolution (2026-07-16)

Built test-first. **Seam:** `api.tenants.seedTenant` (secret-gated public mutation the seed script
drives) — six `convex/tenants.test.ts` cases lock creation, per-slug idempotency (skip, never
overwrite), the token-key contract, and the secret guard.

- **Schema** ([`convex/schema.ts`](../../../convex/schema.ts)): `tenants` table (`by_slug`);
  `tenantSlug?` on `topics` (+ `by_tenant`), `users`, `whitelist`. Shared `tenantThemeValidator` /
  `tenantFlagsValidator` are exported for reuse. `users` is inlined from `authTables` (all original
  fields + `email`/`phone` indexes preserved) to carry the new field.
- **Mutation** ([`convex/tenants.ts`](../../../convex/tenants.ts)): `seedTenant` upserts one tenant
  idempotently. `TENANT_THEME_TOKENS` + `assertThemeTokens` enforce the 14-key contract in code
  (light complete, dark partial). *ponytail:* convex can't import `src/`, so the token list mirrors
  09's future `src/design/tokens.ts` — keep in sync when 09 lands.
- **Seed** ([`scripts/seed-tenants.ts`](../../../scripts/seed-tenants.ts), `pnpm seed-tenants[:prod]`):
  the four fixtures inline; `yknot` carries a partial dark palette.

**Verified on dev:** typecheck clean; seed created exactly 4 rows (14 light tokens each, dark on
`yknot` only, all flags true); second run skipped all four. Full suite green (the one failing
`bundle-authoring-assets` test is a pre-existing CRLF artifact, untouched here). Tenant *admin*
assignment (marking `whitelist` rows) is deferred to [08](08-scope-aware-admin-roles.md)'s mutations
per scope. **Unblocks 08, 10, 12, 14, 15, 17, 18, 23.**
