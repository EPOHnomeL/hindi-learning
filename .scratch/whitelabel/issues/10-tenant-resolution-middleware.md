# whitelabel/10: Tenant resolution middleware

**Status:** open
**Depends on:** [07](07-tenant-schema-and-seed.md)
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[ADR 0021 draft](../adr-0021-draft-tenant-subdomain-model.md) §6.

## Why

Every tenant-aware surface (theme, flags, dashboard scope, cross-host redirect) needs to know
"which tenant is this request for" before it can do anything. This is the one place that answers
that question.

## Scope

- Extend `src/middleware.ts` (today just the Convex Auth wrapper): read the `Host` header, take
  the leftmost label, match against the four known tenant slugs (from the seeded `tenants` rows,
  or the static known-slug set — decide against a Convex read per request vs. a small in-memory
  known-slugs list refreshed occasionally; ponytail leans static list, since new tenants are an
  operator task anyway per 05). No match / bare `my-course.app` / `www.my-course.app` → default
  (no tenant).
- Resolved slug is threaded to the client as a **spoof-safe Convex query arg** — it only selects
  catalogue + skin; no privileged action may trust it (every such action stays gated by
  `isCallerAdmin`/ownership/Shares regardless of the passed slug).
- Local dev: `<slug>.localhost:3000` resolves without a hosts-file edit (Chrome/Edge already
  route `*.localhost` to 127.0.0.1) — verify the middleware's host-parsing handles the `:3000`
  port suffix correctly.
- This issue does **not** build the theme application (11), the redirect (18), or the dashboard
  scope gating (19) — it only produces the resolved tenant slug for those to consume.

## Acceptance criteria

- Visiting `ywampotch.my-course.app` (or `ywampotch.localhost:3000` in dev) resolves to the
  `ywampotch` slug; visiting `my-course.app` or an unrecognised subdomain resolves to no tenant.
- The resolved slug is available to both server components (root layout) and the client (via
  whatever mechanism 11's tenant context uses).
- No behaviour change for the default site.
