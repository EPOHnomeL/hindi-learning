# Producing tenant branding from a Claude design system

The whitelabel workflow for turning **a Claude design system into a tenant's
branding**: the 14-token palette JSON plus a compliant logo and favicon, ready to
seed and upload. The split is deliberate — the *judgement* (mapping a design
system's colours onto our semantic roles) is done by the agent using the table
below; the *mechanical* checks and image conversion are done by
[`scripts/tenant-branding.ts`](../../scripts/tenant-branding.ts)
(`pnpm tenant-branding …`).

Ground truth for the token contract:
[`src/design/tokens.ts`](../../src/design/tokens.ts) (the one canonical list) and
[ADR 0022 §1](../adr/0022-tenant-subdomain-model.md). The upload backend is
`tenants.setTenantAsset` (issue 12); the palette write is `tenants.seedTenant`
(issue 07) or the dashboard.

## Inputs

- **A Claude design system** — e.g. a claude.ai design page or artifact. Those
  pages are login-gated, so the workflow does **not** fetch the URL; **paste the
  design's `:root` CSS custom properties (or its token JSON) into the chat**, or
  drop a file the agent can read. What we need from it: the colour tokens
  (background/surface/text/border/brand/state colours) for light and, if present,
  dark.
- **Logo art you supply** — a raster source (PNG/JPEG/WebP), ideally square and
  ≥512 px. The workflow re-encodes and resizes it; it does **not** generate
  original art. SVG is not accepted as a *final* asset (it's an XSS vector on the
  anonymous landing page — see issue 12), though an SVG can be your source if you
  rasterise it first.

## Step 1 — Map the design system onto the 14 semantic tokens (agent)

Every tenant theme is nothing but an override of these 14 tokens. Map the design
system's roles onto them. `light` must define **all 14**; `dark` is **optional
and may be partial** (unspecified dark tokens fall back to the default dark
palette).

| Our token | Role | Typical design-system source |
|---|---|---|
| `paper` | page background | `background` / `--background` / base 50 |
| `card` | raised surface (cards, quiz) | `card` / `surface` / white |
| `ink` | primary text | `foreground` / `--text` / base 900 |
| `soft` | muted / secondary text | `muted-foreground` / base 500–600 |
| `line` | hairline borders | `border` / base 200 |
| `accent` | **primary brand** (links, kickers) | `primary` |
| `accent2` | secondary brand | `secondary` / a second brand hue |
| `gold` | highlight / ornament | an accent/tertiary, or keep the warm default |
| `hi` | highlight-mark background | a pale tint of `accent` |
| `danger` | error / destructive text | `destructive` |
| `good` | correct-answer surface | `success` (pale) |
| `good-b` | correct-answer border/accent | `success` (saturated) |
| `bad` | wrong-answer surface | `destructive` / `error` (pale) |
| `bad-b` | wrong-answer border/accent | `destructive` / `error` (saturated) |

Notes:
- Values are **bare CSS colours** — `#rrggbb`, `#rrggbbaa`, `rgb(...)`,
  `hsl(...)`. Not a whole declaration: `"#2f5d8a"`, never `"accent: #2f5d8a;"`.
- If the design system has no distinct hue for a role (e.g. no separate `gold`),
  reuse the nearest brand colour or the default warm gold — don't invent noise.
- `good`/`bad` are pale *surfaces*; `good-b`/`bad-b` are their saturated
  *borders*. Derive the pair from one success/error hue.

Write the result as JSON, e.g. `upf-theme.json`:

```json
{
  "light": { "paper": "#f6f8fb", "card": "#ffffff", "ink": "#1e2833", "soft": "#5b6b7b",
    "line": "#dde5ee", "accent": "#2f5d8a", "accent2": "#4a8f8a", "gold": "#c2953f",
    "hi": "#e6eef7", "danger": "#c0432f", "good": "#cfe6d6", "good-b": "#3f7d54",
    "bad": "#f2d6cf", "bad-b": "#c0432f" },
  "dark": { "paper": "#151320", "ink": "#e7e2f2" }
}
```

## Step 2 — Validate the palette (before it touches Convex)

```
pnpm tenant-branding validate upf-theme.json
```

Mirrors the server's `assertThemeTokens`: all 14 light tokens present, no unknown
keys, colours well-formed. Exits non-zero and lists every problem if invalid.

## Step 3 — Convert the supplied art

Requires **ffmpeg** on PATH (already present on the operator machine; the script
uses ffmpeg, not ImageMagick — its `convert` collides with a Windows utility).

```
pnpm tenant-branding logo    upf-src.png  upf-logo.webp     # ≤512 px, WebP (smallest under the cap)
pnpm tenant-branding favicon upf-src.png  upf-favicon.png   # ≤64 px  PNG
```

Both preserve aspect (never upscale), strip to a raster the upload accepts, and
**fail if the output exceeds the 256 KB cap** (the same limit
`setTenantAsset`/`assertEmblemImage` enforce). If a logo exceeds it, prefer
`.webp` output or start from flatter source art.

## Step 4 — Apply

- **Palette** — add the tenant (or edit its `theme.light`/`theme.dark`) via
  `tenants.seedTenant`. The seed driver
  [`scripts/seed-tenants.ts`](../../scripts/seed-tenants.ts) carries the four
  tenants; replace a placeholder palette there and run `pnpm seed-tenants`
  (`--prod` for live — snapshot first). Seeding is idempotent and never
  overwrites an existing slug, so to *update* a live tenant's palette use the
  dashboard (ticket 20) or a one-off `seedTenant`-style edit, not a re-seed.
- **Logo / favicon** — upload the converted files through the dashboard's asset
  widget (ticket 20), which calls `resources.generateUploadUrl` then
  `tenants.setTenantAsset({ tenantSlug, asset, storageId, contentType })`.
  Authorisation: a **sys admin** (any tenant) or that **tenant's admin** (issue
  08). Mint-new-never-overwrite — a new upload swaps the id and leaves the old
  blob resolvable.

Once applied, `tenants.getTheme` resolves the palette + asset URLs, and issue 11
(SSR skin) / issue 13 (lesson palette) render the tenant's brand on its host.
```
