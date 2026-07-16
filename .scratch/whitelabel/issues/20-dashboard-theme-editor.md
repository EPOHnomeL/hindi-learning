# whitelabel/20: Dashboard — theme editor

**Status:** open
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
