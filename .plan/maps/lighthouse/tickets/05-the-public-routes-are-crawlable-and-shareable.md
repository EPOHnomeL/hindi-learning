---
type: task
blocked_by: [01]
---
# The public routes are crawlable, describable and shareable

## Question

Read on 2026-09-21, the four public URLs carry almost no crawl or share metadata:

- **No `robots.txt` and no sitemap.** Neither a static file under `public/` nor a
  `robots.ts` / `sitemap.ts` route exists anywhere in `src/app`.
- **No canonical URL and no Open Graph or Twitter card anywhere in the tree.** A shared
  link to the landing page or a legal page unfurls as a bare URL.
- **The three legal pages set a title and nothing else.** `(legal)/terms/page.tsx`,
  `privacy` and `refunds` each export `metadata` with only a `title`, so all three
  inherit the root layout's single generic `description`, "Your courses, lessons
  grounded in reading." Lighthouse's "Document has a meta description" passes on that
  technically; three pages sharing one description is still a duplicate-content signal.
- The root `generateMetadata` is otherwise in good shape: per-tenant title, manifest,
  icons, apple-web-app. `generateViewport` sets `width=device-width, initial-scale=1`.
  So the viewport and title audits should already pass, and 01 will confirm it.

**Tenancy is the thing that makes this more than five lines of boilerplate**, and it is
why this is a ticket rather than a chore. Every route is dynamic because the root layout
resolves the tenant from the `Host` header. So:

- there is no single canonical origin to hardcode. `SITE_URL` in the Convex deployment
  is "the ONE web-app origin", but a tenant is served from its own host
  (`ywampotch.my-course.app` and others), and a canonical pointing the tenant host at
  the bare domain would be wrong, not merely suboptimal.
- a sitemap and a `robots.txt` must therefore be **per-host**, generated from the
  request the way the title and favicon already are, not static files under `public/`.
- the Open Graph image is a per-tenant question too. `src/app/app-icon/route.tsx`
  already proves the repo can render an image route from tenant data, and `src/lib/pwa.ts`
  records that satori cannot decode webp, which is exactly the trap a tenant logo would
  walk into.

What must **not** change: `/share/[token]`, `/certificate/[token]` and
`/poster/[token]` each set `robots: { index: false, follow: false }` and
`referrer: "no-referrer"` deliberately (ADR 0013: the token is the credential). A
sitemap must not list them, and a broad `Allow:` must not undo them.

## Done when

- The SEO category scores 100 on all four public URLs with the 01 harness, and the
  Answer quotes the before scores from 01's baseline.
- A `robots.txt` and a sitemap are served per host, listing exactly the indexable
  routes, and the Answer names what is listed and what is excluded.
- Each of the four public URLs has its own description, and the three legal pages no
  longer share one.
- A canonical URL is emitted that is correct on a tenant host as well as the bare
  domain, and the Answer states what it resolves to on each and how that was checked.
- A shared link to `/` unfurls with a title, description and image. Verified against a
  real unfurl, not from the emitted tags alone.
- The three token-gated routes are still `noindex`, still `no-referrer`, and absent from
  the sitemap. Verified, not assumed.
