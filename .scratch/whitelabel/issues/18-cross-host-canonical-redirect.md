# whitelabel/18: Cross-host canonical redirect

**Status:** open
**Depends on:** [07](07-tenant-schema-and-seed.md), [10](10-tenant-resolution-middleware.md)
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[ADR 0021 draft](../adr-0021-draft-tenant-subdomain-model.md) §3.

## Why

A course link can be opened on the "wrong" host (e.g. a `upf`-only course opened on
`ywampotch.my-course.app`, or vice versa) — the ADR is explicit this must never 404 or render
under the wrong tenant's skin.

## Scope

- Determine a course's **canonical host**: its subdomain if `topics.tenantSlug` is set, else the
  default site.
- When a course route is requested on a host that isn't its canonical host, redirect to the
  canonical host with the path preserved (query string/hash included).
- This is a rarely-hit safety net, not the primary path — links should already be minted
  canonical (Share/public/certificate links per 03/04 are canonical-host by construction), so no
  redirect loop is expected (the target host always matches the course).
- Skin **always** follows the host the request lands on after any redirect, never the viewer's
  own tenant — this issue doesn't change that (11 already reads `Host`), it just makes sure the
  request lands on the right host before rendering.
- Scope this to course/lesson routes only — it is not a general "redirect everything" rule.

## Acceptance criteria

- Opening a `upf`-tenanted course's URL on `ywampotch.my-course.app` (or the default site)
  redirects to `upf.my-course.app` with the same path, rather than 404ing or rendering under the
  wrong tenant's skin.
- Opening a course with no `tenantSlug` on any tenant subdomain redirects to the default site
  (its canonical host).
- Opening a course already on its canonical host is a no-op (no redirect, no loop).
