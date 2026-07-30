---
type: task
blocked_by: [07, 10]
---
# Cross-host canonical redirect

## Question

A course link can be opened on the "wrong" host (e.g. a `upf`-only course opened on
`ywampotch.my-course.app`) — the ADR is explicit this must never 404 or render under the wrong
tenant's skin. Ground truth: ADR 0021 §3. Scope:

- Determine a course's **canonical host**: its subdomain if `topics.tenantSlug` is set, else the
  default site.
- When a course route is requested on a host that isn't its canonical host, redirect to the
  canonical host with the path preserved (query string/hash included).
- A rarely-hit safety net — links should already be minted canonical, so no redirect loop expected.
- Skin **always** follows the host the request lands on after any redirect; this issue just makes
  sure the request lands on the right host before rendering.
- Scope to course/lesson routes only, not a general "redirect everything" rule.

## Done when

Opening a `upf`-tenanted course's URL on `ywampotch.my-course.app` (or the default site) redirects
to `upf.my-course.app` with the same path; opening a course with no `tenantSlug` on any subdomain
redirects to the default site; opening a course already on its canonical host is a no-op (no loop).

## Answer

Resolved 2026-07-18.

The canonical-host decision is a pure function, `canonicalRedirect(currentUrl, courseTenant)` in
`src/lib/tenant.ts`: it strips any known-tenant label to find the base domain
(`my-course.app`/`localhost`), re-attaches the course's tenant (or none for the default site), and
returns the absolute redirect URL — path, query, and port preserved, only the host swapped — or
`null` when already canonical. The `null` no-op is the loop guard and is tested explicitly (both the
tenanted-on-its-subdomain and untenanted-on-apex cases), alongside the three acceptance criteria and
the `<slug>.localhost` dev hosts. 20 unit tests in `src/lib/tenant.test.ts`.

Wiring (kept minimal / ponytail):
- The course's canonical tenant comes from a tiny public, unauthenticated Convex query
  `content.topicTenant(slug)` — exposes only the tenant label, never content; unknown slug → `null`
  (default site), so a stale link can't force a loop. No new edge DB read: the lookup runs in the
  loader, not the middleware.
- `src/middleware.ts` stamps `x-url` (the request URL) so the loader can reconstruct path + query
  when swapping the host — one cheap additive header alongside the existing tenant-slug stamp.
- The redirect lives in the course route's shared server layout
  (`src/app/(app)/courses/[slug]/layout.tsx`), the single chokepoint for every course/lesson/
  reference route — scoped to course routes only, as required. A transient Convex error degrades to
  no redirect (best-effort safety net, never a hard block).

**Browser check pending** (like 11/13/19–24): the end-to-end redirect behaviour (actual cross-host
3xx + fragment preservation) is a manual browser verification; the host-decision logic is fully
unit-covered.
