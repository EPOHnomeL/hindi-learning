---
type: task
blocked_by: [11, 12, 19]
---
# Dashboard — theme editor

## Question

This is the "Theme" section of 19's per-tenant panel — the piece that actually lets an admin change
how their tenant looks, without touching Convex directly. Ground truth: 06's resolution decision 3.
Scope:

- **Both** editing modes: a JSON-import textarea (paste a full 14-token set for light and/or dark,
  validated against `src/design/tokens.ts` before saving) and structured per-token fields (one
  labeled color-picker/swatch per token, light/dark tabs).
- A live preview pane showing the edited palette applied to a representative chunk of chrome.
- Logo and favicon upload slots, wired to 12's upload mutations.
- Edit-is-live (03 — no draft/published): saving updates `tenants.theme` directly; the live
  subdomain reflects it on next SSR render (11).
- Scope-checked: a tenant admin edits only their own tenant's theme; sys admin any.

## Done when

Pasting valid 14-token JSON updates the structured fields and saving persists to
`theme.light`/`theme.dark`; editing a single structured field and saving updates just that token;
uploading a logo/favicon shows on the tenant's live subdomain (via 12 + 11); a tenant admin cannot
edit another tenant's theme (mutation throws).

## Answer

Built test-first 2026-07-18 (`/tdd` + `/ponytail`). Committed on `main`.

**Backend** (`convex/tenants.ts`, commit `46ff5fc`)
- **`updateTenantTheme`** — identity-guarded (`isCallerAdmin(ctx, tenantSlug)`) twin of the
  secret-guarded `setTenantTheme`, so a signed-in admin repaints from the dashboard without
  `PUBLISH_SECRET`. Extracted **`themeWithAssetsPreserved`** so both write paths fold a palette
  identically (replace `light`, take `dark` only if given, carry `logo`/`favicon` across). 6 TDD
  tests: sys repaints any tenant; tenant admin own-only + cross-tenant throws; member refused; asset
  preservation / stale-dark clear / partial dark; missing-token reject; unknown-slug reject.

**Frontend** (`src/app/_components/AdminPanel.tsx`, committed in `be39b9a`)
- **`ThemeEditor`** fills the Theme `<TenantSection>`: JSON-import textarea (validates the 14-token
  light/dark contract against `src/design/tokens.ts` before applying), structured per-token color
  fields with light/dark tabs, a live preview pane, and logo/favicon upload slots (reusing
  `generateUploadUrl` → `setTenantAsset`, SVG refused). Edit-is-live — save calls `updateTenantTheme`;
  the subdomain reflects it on next SSR render (11).

**Verified:** typecheck clean; 451 backend tests pass; `pnpm build` compiles `/admin`. UI behaviour
(import↔structured sync, single-token edit, upload → live subdomain) is the pending browser check —
dev has operator accounts only, same posture as 11/13/19/21/22.

**Note:** committed by a concurrent session; its subject (`be39b9a`) bundles the Flags-toggle UI too,
so attribution is mixed — but the theme-editor code and its backend are all present and green.
