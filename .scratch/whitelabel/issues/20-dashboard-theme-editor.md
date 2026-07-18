# whitelabel/20: Dashboard — theme editor

**Status:** implemented (2026-07-18, `/tdd` + `/ponytail`) — UI browser check pending (needs an
authed sys-admin/tenant-admin session; static gates green)
**Depends on:** [11](11-ssr-theme-application.md), [12](12-brand-asset-upload.md),
[19](19-dashboard-tenants-tab-shell.md)
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[06 — Resolution](06-scope-operator-whitelabel-dashboard.md) decision 3.

## Why

This is the "Theme" section of 19's per-tenant panel — the piece that actually lets an admin
change how their tenant looks, without touching Convex directly.

## Scope

- **Both** editing modes, per the grilled decision:
  - A JSON-import textarea: paste a full 14-token set (matching how a Claude/Figma design
    handoff arrives) for light and/or dark; validates against `src/design/tokens.ts`'s token list
    (09) before saving.
  - Structured per-token fields: one labeled color-picker/swatch per named token, light and dark
    tabs, for fine-tuning after an initial import.
- A live preview pane showing the edited palette applied to a representative chunk of chrome.
- Logo and favicon upload slots, wired to [12](12-brand-asset-upload.md)'s upload mutations.
- Edit-is-live (03's storage decision — no draft/published states): saving updates the
  `tenants.theme` field directly; the tenant's live subdomain reflects it on next SSR render (11).
- Scope-checked: a tenant admin edits only their own tenant's theme; sys admin any tenant.

## Acceptance criteria

- Pasting a valid 14-token JSON set into the import textarea updates the structured fields to
  match, and saving persists it to the tenant's `theme.light`/`theme.dark`.
- Editing a single structured field and saving updates just that token, leaving the rest
  unchanged.
- Uploading a logo/favicon through this UI results in the tenant's live subdomain showing the
  new asset (via 12 + 11).
- A tenant admin cannot edit another tenant's theme (mutation throws if attempted).

## Resolution (2026-07-18)

Built test-first across a Theme-editor stream (see handoff B). Committed on `main`.

**Backend** ([convex/tenants.ts](../../../convex/tenants.ts), commit `46ff5fc`)
- **`updateTenantTheme`** — identity-guarded (`isCallerAdmin(ctx, tenantSlug)`) twin of the
  secret-guarded `setTenantTheme`, so a signed-in admin repaints from the dashboard without
  `PUBLISH_SECRET`. Extracted **`themeWithAssetsPreserved`** so both write paths fold a palette
  identically (replace `light`, take `dark` only if given, carry `logo`/`favicon` across). 6 TDD
  tests: sys repaints any tenant; tenant admin own-only + cross-tenant throws; member refused;
  asset preservation / stale-dark clear / partial dark; missing-token reject; unknown-slug reject.

**Frontend** ([src/app/_components/AdminPanel.tsx](../../../src/app/_components/AdminPanel.tsx),
committed in `be39b9a`)
- **`ThemeEditor`** fills the Theme `<TenantSection>`: JSON-import textarea (validates the 14-token
  light/dark contract against `src/design/tokens.ts` before applying), structured per-token color
  fields with light/dark tabs, a live preview pane, and logo/favicon upload slots (reusing
  `generateUploadUrl` → `setTenantAsset`, SVG refused). Edit-is-live — save calls
  `updateTenantTheme`; the tenant's subdomain reflects it on next SSR render (11).

**Verified:** `pnpm typecheck` clean; 451 backend tests pass; `pnpm build` compiles `/admin`. UI
behaviour (import↔structured sync, single-token edit, upload → live subdomain) is the pending
browser check — dev has operator accounts only, same posture as 11/13/19/21/22 in this feature.

**Note:** committed by a concurrent session; its subject (`be39b9a`) bundles the Flags-toggle UI
too, so attribution is mixed — but the theme-editor code and its backend are all present and green.
