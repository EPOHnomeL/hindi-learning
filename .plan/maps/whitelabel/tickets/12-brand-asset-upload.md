---
type: task
blocked_by: [07, 08]
---
# Brand asset upload

## Question

The theme record's `logo`/`favicon` are storage ids; something has to let an admin actually upload
the raster files that fill them. This is a backend mutation pair — the dashboard UI (20) just calls
it. Ground truth: 03 decision 3. Scope:

- Reuse the existing `convex/emblem.ts` rail verbatim: `resources.generateUploadUrl` for the client
  upload, a mutation that validates type (raster only — PNG/JPEG/WebP; **refuse SVG**, same XSS
  reasoning — tenant landing pages are anonymous-reachable) and size, then sets `tenants.theme.logo`
  or `.favicon` to the new storage id.
- **Mint-new-never-overwrite** — uploading swaps the id, never mutates a previous blob.
- Scope-check with `isCallerAdmin(ctx, tenantSlug)` (08) — a tenant admin only their own tenant.
- `getUrl`-style read for rendering (11 exposes `logoUrl`; favicon read server-side in 11's
  `generateMetadata`).

## Done when

A sys admin (or matching tenant admin) can upload a logo/favicon for a tenant and an SVG upload is
rejected; a upf tenant admin cannot upload for ywampotch (mutation throws); uploading a new asset
doesn't touch the previous asset's storage id.

## Answer

Built test-first 2026-07-17 (`convex/tenants.test.ts`, +6 tests). One mutation, maximum reuse
(ponytail) — no new upload rail, no new validator.

- **`setTenantAsset({ tenantSlug, asset, storageId, contentType })`** (`convex/tenants.ts`) —
  `asset` is `"logo" | "favicon"`. The client uploads the raster via the existing
  `resources.generateUploadUrl` (auth-gated), then hands the storage id here.
- **Validation reuses `assertEmblemImage` verbatim** (`convex/emblem.ts`): raster only
  (PNG/JPEG/WebP), SVG refused (anonymous-page XSS), size-capped at `EMBLEM_IMAGE_MAX_BYTES`
  (256 KB). The produce-branding workflow emits assets inside that cap.
- **Scope-gated** by `isCallerAdmin(ctx, tenantSlug)` (08): sys admin any tenant, tenant admin only
  their own; member/other-tenant admin refused server-side.
- **Mint-new-never-overwrite** — records the new id, never deletes the old blob; the patch spreads
  the existing `theme` so the palette is untouched and only one id changes. `getTheme` (11) already
  resolves the ids to urls, so no read-side change was needed.

The dashboard upload widget that calls this is ticket 20.
