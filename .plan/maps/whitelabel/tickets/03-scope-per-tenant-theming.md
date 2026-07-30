---
type: grilling
blocked_by: [01, 02]
---
# Scope per-tenant branding & theming

## Question

Each tenant site (upf, ywampotch, almighty-warrior, yknot) needs its own look: logo, palette,
typography, landing copy. Ticket 01 turns the design system into tokens; ticket 02 gives us a
tenant record; this ticket scopes how a tenant's theme is authored, stored, and applied.
User-pinned: styling is the top priority, and tenant themes are authored as **Claude design
systems** — so the theme shape must be something a generated design system compiles down to (a
token override, per 01). Answer:

- Theme shape: a token-override object on the tenant record — how much is themeable in v1?
  (Recommendation to test: palette + logo + name + landing copy only; typography later.)
- Application mechanism: server-render CSS variables from the resolved tenant in the root layout
  (no flash, no client fetch)? Fonts self-hosted per tenant or one shared stack?
- Brand assets: logos/og-images as Convex storage blobs (Emblem-style mint-new), favicon per tenant?
- Surface inventory: dashboard/reader chrome, Landing (per-tenant copy?), invite emails,
  Certificates, the print stylesheet.
- Published lesson blobs: apply the 01 render-time decision; confirm it holds for translations too.
- Who edits a theme — the operator via the dashboard (06). This ticket only decides the theme
  *record* the dashboard edits.

Out of scope: the token system (01), tenant resolution (02), tenant self-service theming UI.

## Done when

A deliverable is produced: the theme record shape, the application mechanism (SSR CSS vars), the
v1 themeable-surface list, and mock theme values for the four named tenants as the acceptance
fixture.

## Answer

Resolved 2026-07-15 (opus grilling), 8 decisions. 01 had already pinned the colour contract
(14-token `TenantTheme`) and the `buildSrcDoc` rail; 03 owned the rest of the record, storage,
assets, the no-flash mechanism, and per-surface disposition.

**Findings (verified this session):** `tenants` table doesn't exist yet (record designed clean);
root layout is a Server Component that already runs a pre-paint inline script stamping
`data-theme` — the per-tenant palette rides the same "before paint" idea; the app has no
server-side Convex fetch today (SSR palette introduces the first `fetchQuery`); `src/middleware.ts`
exists (Convex Auth wrapper); `convex/emblem.ts` is a ready storage template (validate type/size,
`getUrl`, mint-new, SVG refused); every artifact assembles through one `buildSrcDoc` (lesson
iframe uses bare vars, chrome uses `--color-`); `inviteEmail.ts` is parameterised by a flat hex
palette `C` + hardcoded `BRAND`; `Certificate.tsx` hardcodes `"My Course"` ×2 and has an
`@media print` A4 stylesheet.

**Decisions:**
1. **Storage & shape — inline nested object on the `tenants` row; edit-is-live.** No separate
   `themes` table, no draft/published states in v1. One `by_slug` read resolves slug + displayName
   + theme + flags.
2. **Typography — shared font stack, no per-tenant fonts in v1** (highest-cost/lowest-payoff;
   `next/font` is build-time; runtime fonts threaten no-flash; Devanagari is load-bearing). No
   `fontStack` field.
3. **Assets — logo + favicon** (og-image deferred). Both optional `Id<"_storage">`, raster-only
   (PNG/JPEG/WebP; SVG refused — anonymous landing XSS), single. Reuse the emblem rail. Logo → text
   wordmark fallback; favicon → shared `/icon.svg`.
4. **Landing — bespoke per-tenant pages hand-authored in code**, no DB, nothing runtime-editable.
   Selection = slug→component registry (`src/app/_landing/registry.ts`) in `page.tsx`'s
   `<Unauthenticated>` branch, falling back to default `<Landing/>` (still re-skinned by palette).
   Dashboard does **not** edit landing.
5. **Application — SSR server-fetch, no flash (option A).** Root layout: Host → slug →
   `fetchQuery(tenants.getTheme)` → inject `<style id="tenant-theme">` for `:root` (light) +
   `:root[data-theme="dark"]` (tenant dark, else default dark) before body paint. Favicon via
   `generateMetadata`. Logo is flash-tolerant → client tenant context (one `useQuery`). Palettes
   stay runtime-editable.
6. **Lessons — render-time `buildSrcDoc` palette override** (= 01 #1). `buildSrcDoc` gains
   `tenantPalette?` → injects one more `<style>` (bare-var light + dark) on the dark/Devanagari
   rail. Covers lessons + references + translated Editions. Partial fidelity on legacy accepted;
   full fidelity from generate-in-style. Downstream: a backfill/migration script (not this scope).
7. **Email — full palette-derived, logo'd, light-only.** Thread the tenant into `renderInviteEmail`:
   `BRAND` → `displayName`; `C` derived from the tenant's light tokens (`page←paper`, `card←card`,
   `border←line`, `heading←ink`, `body/muted←soft`, `accent←accent`); logo header `<img>` with
   wordmark fallback.
8. **Certificate — identity-only, styling frozen (option B).** Replace the two `"My Course"` with
   `displayName`, add the logo, but **freeze the palette** to the default gold-foil via a
   `.cert-doc` token reset (screen and print).

**Theme record shape** (inline on `tenants`): `theme: v.object({ light: v.record(v.string(),
v.string()), dark: v.optional(...), logo: v.optional(v.id("_storage")), favicon: v.optional(...) })`.
Tokens (from 01): `paper card ink soft line accent accent2 gold hi danger good good-b bad bad-b`.

**Mock theme values** for the four tenants are captured as the acceptance fixture (placeholders —
real Claude design systems land later): upf academic slate-blue, ywampotch warm missions
orange/teal, almighty-warriors bold navy/gold, yknot indigo/violet (the one with a `dark` block,
to exercise the optional-dark shape). Full hex sets recorded in the source ticket. Unblocks the
theming half of 06.
