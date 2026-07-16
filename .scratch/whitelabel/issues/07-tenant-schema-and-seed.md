# whitelabel/07: Tenant schema & seed

**Status:** open
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
