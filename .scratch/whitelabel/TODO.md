# Whitelabel — follow-up todos

Running list of whitelabel work still to do, captured 2026-07-17 after seeding all
four tenants on prod and shipping the yknot brand (palette + logo + favicon +
tenant-aware header + palette-driven hero gradients). Links point at the numbered
issues where a mechanism already exists.

## Custom landing pages (the headline ask)

- [ ] **Build the landing-page registry** — [issue 16](issues/16-per-tenant-landing-pages.md).
      `src/app/_landing/registry.ts` (slug → component), `page.tsx` `<Unauthenticated>`
      selects it, default `<Landing/>` fallback. No DB, ships via commit + deploy.
- [ ] **Hand-author a bespoke landing page per tenant**, registered in `registry.ts`:
  - [ ] `yknot` — sailing/knot brand world (see the Brand Showcase: Montserrat, sailing
        imagery, tan+navy+teal). Currently falls back to the re-skinned default `<Landing/>`.
  - [ ] `upf` (upfsa.co.za) — royal/navy blue.
  - [ ] `ywampotch` (ywampotch.com) — slate blue-greys + gold.
  - [ ] `almighty-warriors` — monochrome charcoal.
  - Each inherits the SSR palette (11); layer bespoke copy/layout on top.

## Brand assets

`yknot`, `upf`, and `ywampotch` now have a logo + favicon uploaded on prod.

- [x] **yknot** — horizontal lockup (from the Brand Showcase) + cube favicon.
- [x] **upf** — logo rasterised from upfsa.co.za `logo.svg` (via `pnpm dlx sharp-cli`,
      since no local SVG rasteriser); favicon from their `cropped-favicon-192x192.png`.
- [x] **ywampotch** — real YWAM Potch banner logo (blue mark + wordmark on cream); favicon
      cropped from the blue person-mark. (First pass wrongly used the UofN seal — corrected,
      and the palette re-derived to deep royal-blue on cream, not the Weebly slate-grey.)
- [x] **almighty-warriors** — charcoal impossible-triangle logo; favicon cropped to the triangle.
- Rails: `resources.generateProcessedUploadUrl` + `tenants.seedTenantAsset` (both
  secret-guarded); upload needs `PROD_CONVEX_DEPLOY_KEY` only for the one-time function deploy.

## App-chrome brand rollout

- [ ] **Extend `<Brand>` to the other headers.** Only the landing nav uses it; Dashboard,
      SignIn, CourseShell, and PublicReader still hardcode "My Course" + the book `Logo`.
      Route them through `<Brand>` so tenant logo/name shows app-wide.

## Palette polish

- [ ] **Per-tenant dark palettes.** All four are light-only; dark falls back to the app
      default (which is warm/terracotta, off-brand for the blue/slate/mono tenants). Decide
      whether to author dark per tenant or derive one.
- [ ] **Audit remaining hardcoded gradient/colour literals.** `.cert-stage` is fixed
      (color-mix over tokens); sweep for other hardcoded RGBA that won't follow a tenant
      palette (e.g. specular white highlights are fine; brand-colour literals are not).

## Verification (unblocked now that prod is seeded)

- [ ] **Browser-verify each tenant host** — [11](issues/11-ssr-theme-application.md) skin +
      no-flash on upf/ywampotch/almighty-warriors (yknot done).
- [ ] **Lesson palette** — [13](issues/13-lesson-tenant-palette-override.md) needs a
      published course under a tenant host to check.

## Infra / ops loose ends

- [ ] **Vercel `NEXT_PUBLIC_CONVEX_URL` has a trailing slash** (`…convex.cloud/`). Works, but
      `scripts/_env.ts` strips trailing slashes because `ConvexHttpClient` rejects them —
      clean it up in Vercel env to avoid a future footgun.
- [ ] **Prod Convex is not deployed by the Vercel build** (`build` is just `next build`). New
      backend functions need a manual `convex deploy` with the prod key
      (`PROD_CONVEX_DEPLOY_KEY`). Consider a documented deploy step or wiring
      `convex deploy` into the build so frontend and backend can't drift on prod.
- [ ] **`setTenantTheme` reached prod** via the 2026-07-17 manual deploy — use it (not a
      re-seed) to repaint an existing tenant going forward. Dashboard theme editor is
      [issue 20](issues/20-dashboard-theme-editor.md).
