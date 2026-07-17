# whitelabel/12: Brand asset upload

**Status:** done (2026-07-17)
**Depends on:** [07](07-tenant-schema-and-seed.md), [08](08-scope-aware-admin-roles.md)
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[03 — Resolution](03-scope-per-tenant-theming.md) decision 3.

## Why

The theme record's `logo`/`favicon` are storage ids; something has to let an admin actually
upload the raster files that fill them. This is a backend mutation pair — the dashboard UI (20)
just calls it.

## Scope

- Reuse the existing `convex/emblem.ts` rail verbatim: `resources.generateUploadUrl` for the
  client upload, a mutation that validates type (raster only — PNG/JPEG/WebP; **refuse SVG**,
  same XSS reasoning as emblem — tenant landing pages are anonymous-reachable) and size, then
  sets `tenants.theme.logo` or `tenants.theme.favicon` to the new storage id.
- **Mint-new-never-overwrite**: uploading a new logo/favicon creates a new storage blob and
  swaps the id; it never mutates a previously-uploaded blob in place (matches the emblem
  pattern — old links, if any exist, keep resolving to the old asset until GC).
- Scope-check the mutation with `isCallerAdmin(ctx, tenantSlug)` from
  [08](08-scope-aware-admin-roles.md) — a tenant admin may only upload for their own tenant, a
  sys admin for any.
- `getUrl`-style read for rendering (the client tenant context in 11 exposes `logoUrl`; favicon
  is read server-side in 11's `generateMetadata`).

## Acceptance criteria

- A sys admin (or the matching tenant admin) can upload a logo/favicon for a tenant; an SVG
  upload is rejected.
- A tenant admin for `upf` cannot upload an asset for `ywampotch` (mutation throws).
- Uploading a new asset doesn't touch the previous asset's storage id — old references, if any,
  keep working.

## Resolution (2026-07-17)

Built test-first (`convex/tenants.test.ts`, +6 tests). One mutation, maximum reuse
(ponytail) — no new upload rail, no new validator.

- **`setTenantAsset({ tenantSlug, asset, storageId, contentType })`**
  ([convex/tenants.ts](../../../convex/tenants.ts)) — `asset` is `"logo" | "favicon"`.
  The client uploads the raster via the **existing** `resources.generateUploadUrl`
  (auth-gated), then hands the storage id here.
- **Validation reuses `assertEmblemImage` verbatim** ([convex/emblem.ts](../../../convex/emblem.ts)):
  raster only (PNG/JPEG/WebP), **SVG refused** (same anonymous-page XSS reasoning —
  tenant logos render on public landing pages), size-capped at
  `EMBLEM_IMAGE_MAX_BYTES` (256 KB). The produce-branding workflow emits assets
  inside that cap.
- **Scope-gated** by `isCallerAdmin(ctx, tenantSlug)` (issue 08): a sys admin may
  set any tenant's asset, a tenant admin only their own; a member or other-tenant
  admin is refused server-side.
- **Mint-new-never-overwrite** — records the new id, never deletes the old blob; the
  patch spreads the existing `theme` so the palette is untouched and only one id
  changes. `getTheme` (issue 11) already resolves `logo`/`favicon` ids to urls, so
  no read-side change was needed.

The dashboard UI that calls this (upload widget on the emblem-rail pattern) is
ticket 20; this issue is the backend the UI drives.
