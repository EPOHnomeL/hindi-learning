# Whitelabel — follow-up todos

Running list of whitelabel work still to do, captured 2026-07-17 after seeding all
four tenants on prod and shipping the yknot brand (palette + logo + favicon +
tenant-aware header + palette-driven hero gradients). Links point at the numbered
issues where a mechanism already exists.

**Reconciled against `main` on 2026-07-29** (docs-reconciliation sweep): the
numbered issues 01–24 have all landed — including the dashboard Tenants tab with
its theme editor, flag toggles, course/member assignment and tenant-admin grant
(`AdminPanel.tsx` §Theme/Flags/Courses/Members). What remains below is the
follow-up work only.

## Custom landing pages (the headline ask)

- [x] **Build the landing-page registry** — [issue 16](issues/16-per-tenant-landing-pages.md).
      Shipped as `src/app/_landing/registry.ts` (slug → component via `next/dynamic`,
      plus a pure `landingFor()` lookup and `registry.test.ts`); `page.tsx` selects it,
      default `<Landing/>` fallback. No DB, ships via commit + deploy.
- [ ] **Hand-author a bespoke landing page per tenant**, registered in `registry.ts`:
  - [x] `ywampotch` (ywampotch.com) — slate blue-greys + gold. Shipped as
        `src/app/_landing/YwamPotch.tsx` (`ca73dc8`), the only registry entry so far.
  - [ ] `yknot` — sailing/knot brand world (see the Brand Showcase: Montserrat, sailing
        imagery, tan+navy+teal). Currently falls back to the re-skinned default `<Landing/>`.
  - [ ] `upf` (upfsa.co.za) — royal/navy blue.
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

- [ ] **Extend tenant branding to the last header — `CourseShell`** (the signed-in
      reader). Mostly done: `PublicReader` uses `<Brand>` (`5cd6b76`), and `Dashboard`
      + `SignIn` render `tenant.logoUrl` / `tenant.displayName` / `tenant.motto`
      directly with the "My Course" fallback (`18af604`). `CourseShell` is the
      remaining gap — it shows no brand mark at all. Consider routing all of them
      through `<Brand>` so there is one seam rather than three call sites.

## Palette polish

- [x] **Per-tenant dark palettes.** Resolved by **derivation**, not authoring
      (`311dde3`, 2026-07-29): `deriveDarkFromLight` in `src/design/tokens.ts` re-lights
      the tenant's own light palette for a dark surface via CSS relative colour syntax
      (`oklch(from <color> L C H)`) — no colour library. Surfaces come off the tenant's
      ink, text off their paper; quiz right/wrong stay on the default dark because those
      are semantics, not brand. `theme.dark` remains optional and, when present, is
      emitted after the derived tokens so an authored token still wins. Two follow-on
      fixes landed with it: the light block is gated on `:not([data-theme="dark"])`
      (`81b675b`) and the lesson iframe's dark surfaces follow the palette (`65a28a4`).
- [ ] **Audit remaining hardcoded gradient/colour literals.** `.cert-stage` is fixed
      (color-mix over tokens), and the lesson dark surfaces + quiz option labels were
      swept (`65a28a4`, `32ec4b3`). Sweep the rest for hardcoded RGBA that won't follow
      a tenant palette (specular white highlights are fine; brand-colour literals are not).

## Verification (unblocked now that prod is seeded)

- [ ] **Browser-verify each tenant host** — [11](issues/11-ssr-theme-application.md) skin +
      no-flash on upf/ywampotch/almighty-warriors (yknot done).
- [ ] **Lesson palette** — [13](issues/13-lesson-tenant-palette-override.md) needs a
      published course under a tenant host to check. Now unblocked: per-Edition
      Publishing shipped (ADR 0024) and the palette fix landed in `65a28a4`.

## Infra / ops loose ends

- [ ] **Vercel `NEXT_PUBLIC_CONVEX_URL` has a trailing slash** (`…convex.cloud/`). Works, but
      `scripts/_env.ts` strips trailing slashes because `ConvexHttpClient` rejects them —
      clean it up in Vercel env to avoid a future footgun. (Not re-verified in this sweep —
      Vercel env vars aren't readable from the repo.)
- [x] ~~**Prod Convex is not deployed by the Vercel build**~~ — **this was wrong, and is
      resolved either way.** The claim read `package.json` (`"build": "next build"`), but
      Vercel's own build command overrides it. Verified against the `ef12177` production
      build log on 2026-07-29: Vercel runs `npx convex deploy --cmd 'pnpm run build'`,
      which deploys to `capable-barracuda-769` (prod) and *then* runs `next build`.
      **Pushing `main` therefore deploys prod Convex** — frontend and backend cannot
      drift, and no manual `convex deploy` is needed. See the "Environments & deploy"
      section of `docs/agents/project-context.md`, which was right all along.
- [x] **Theme repaints no longer need a script.** `setTenantTheme`/`updateTenantTheme`
      are on prod, and the **dashboard theme editor**
      ([issue 20](issues/20-dashboard-theme-editor.md)) shipped — `ThemeEditor` in
      `AdminPanel.tsx`. Repaint an existing tenant there, not by re-seeding.
