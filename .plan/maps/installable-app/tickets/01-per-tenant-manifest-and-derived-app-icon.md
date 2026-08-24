---
type: task
blocked_by: []
---
# Per-tenant manifest and a derived App Icon

## Question

What does a browser have to be handed before it will offer to install this app as the *tenant's*
app rather than the platform's - and where does the square icon come from, given no tenant has one?

Two route handlers, both resolving the tenant the way everything else does.

**`/manifest.webmanifest`.** A route handler, **not** Next's `app/manifest.ts` convention: that
convention is statically generated at build time and therefore cannot vary by `Host`, which is the
one thing this file must do. It reads `getTenantView()` from `src/lib/tenant-server.ts` - the same
one-indexed-lookup rail the root layout already uses per request, with the same
degrade-to-defaults `try/catch`, because a manifest is branding and must never 500 a page.

Fields: `name` and `short_name` from `displayName`; `theme_color` and `background_color` from the
tenant's own palette tokens; `display: "standalone"`; `start_url` and `scope` both `/`; an `id`.
**The default site gets a manifest too** - "My Course" and the globals.css palette - or the apex
becomes the single host where install silently does nothing.

**The App Icon.** Composited at request time from the tenant's Logo, `object-contain` with padding,
centred on an **opaque** square of the tenant's palette, rendered by `ImageResponse` from
`next/og`. This is in Next 15 already, so it needs **no new dependency** and no image-processing
library; it fetches the remote `logoUrl` from Convex storage server-side.

Four outputs: **192** and **512** (Chrome's installability floor and its splash), a **maskable**
variant with the logo scaled to roughly 60% so Android's circular crop does not eat it, and **180**
for `apple-touch-icon`. Opaque is not cosmetic - iOS renders any transparency as solid black.

Fall back in order: tenant Logo -> tenant Favicon -> the shipped `icon.svg` mark, so an unseeded
host and the default site both still get a real icon.

The rejected alternative and why is in
[ADR 0030](../../../../docs/adr/0030-installable-per-tenant-app.md) §2 - in short, a fourth
uploaded brand asset would make four design chores a precondition for shipping, and would still
need this derived path built for the missing-asset case.

## Done when

- `curl` against each tenant host returns a manifest naming that tenant, with its palette colours,
  `Content-Type: application/manifest+json`.
- The apex returns a valid default-site manifest.
- All four icon sizes render, opaque, with the tenant Logo legible and contained - **checked on
  YWAM specifically**, whose ~7:1 banner is the hard case and is expected to read as a wide logo in
  a coloured square.
- `viewport` and `themeColor` are exported from the root layout, and `apple-touch-icon` plus
  `apple-mobile-web-app-capable` are linked (older iOS needs the meta tag; 16.4+ honours the
  manifest's `display`).
- Chrome DevTools -> Application -> Manifest shows no errors and reports the app as installable
  once ticket 02 lands the service worker.
- An unseeded host degrades to the default manifest rather than erroring.

## Answer

Built 2026-08-24. Three pieces, exactly as specified:

- **`src/lib/pwa.ts`** holds the pure seams, pinned by `src/lib/pwa.test.ts` (8 tests):
  `buildManifest(tenant)` and `appIconSpec(tenant, {size, maskable})`, both taking the
  `getTenantView()` shape with `null` as the default site AND the degrade path.
  `theme_color`/`background_color`/icon background are all the tenant's light **paper**
  (not accent): the Logo already renders on paper in the app header, so legibility there
  is a property the brand has proven. Icon source falls back Logo, then Favicon, then
  `null` meaning the shipped `/icon.svg` mark. Contain box is 80% of the square, 60%
  maskable.
- **`src/app/manifest.webmanifest/route.ts`** is the route handler (a dotted route
  *directory*, not Next's static `app/manifest.ts` convention). Note: the middleware
  matcher skips dotted paths, so no `x-tenant-slug` header is stamped on this route;
  it resolves anyway because `getTenantSlug` falls back to parsing `Host` directly.
- **`src/app/app-icon/route.tsx`** renders the icon by `ImageResponse`, sizes via query
  string (`?size=192|512|180`, `&maskable=1`) because the manifest needs distinct URLs
  and four route files would say the same thing. Size clamped 48 to 1024. The root
  layout exports `generateViewport` (per-tenant `themeColor`) and links the manifest,
  `apple-touch-icon`, and both `mobile-web-app-capable` metas: Next's `appleWebApp`
  emits only the modern one, so the apple-prefixed original pre-16.4 iOS needs is added
  via `other`.

**Evidence, and which kind.** Walked live against a dev server on port 3199 and the dev
Convex deployment (not just read): `curl -H "Host: ywampotch.localhost"` returned the
YWAM Potch manifest with its own paper `#fdf8f2` and `Content-Type:
application/manifest+json`; the apex returned the valid "My Course" default; all four
icon sizes returned 200 `image/png`, opaque, rendered and looked at; the rendered `/`
head carries the manifest link, theme-color, viewport, apple-touch-icon and both
capable metas. The unseeded/degrade path is unit-tested and is also what the apex walk
exercised.

**The YWAM 7:1 check, honestly.** No dev tenant has a logo/favicon seeded (verified:
`getTheme` returns `logoUrl: null` for all four), and this session was not permitted to
copy the prod logo into dev, so the *tenant-data* render used the shipped-mark fallback.
The 7:1 case itself was still walked mechanically: a generated 700x100 raster banner was
rendered through `appIconSpec` and the route's exact JSX via the same `ImageResponse`,
at 512 and 512-maskable, and read as expected: a wide logo contained with padding on an
opaque paper square, smaller inside the maskable safe zone. What remains unwalked is
only satori fetching a logo over https from Convex storage; the fallback already
exercises the same fetch-and-composite path against `/icon.svg` on the live server.

DevTools "installable" is deliberately not claimed: Chrome will not report it until
ticket 02 lands the service worker, per this ticket's own Done-when.

**Field correction (2026-08-24, commit `b523ac8`).** The unwalked remainder bit exactly
where flagged: YWAM's prod logo is **webp**, which satori cannot decode and renders as
NOTHING, silently, so the first real install dialog showed a bare paper square. The
route now fetches the candidates itself, sniffs magic bytes (`satoriImageType`,
unit-tested against the real prod files), and uses the first source satori can decode:
logo, then favicon, then the shipped mark. YWAM's icon is its favicon emblem (jpeg)
until someone re-uploads the logo as png; `scripts/tenant-branding.ts` now documents
the caveat.
