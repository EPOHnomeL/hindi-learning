# whitelabel/05: Provision the four tenant subdomains

**Status:** open
**Depends on:** —
**Labels:** wayfinder:task

Child of [Whitelabel map](00-whitelabel-map.md).

## Question

Make `upf.my-course.app`, `ywampotch.my-course.app`, `almighty-warrior(s).my-course.app`, and
`yknot.my-course.app` resolve to the production app, so per-subdomain styling can be developed
and demoed against real hosts. This is a **task** (execution carried in-map by user instruction
— "you can so long create them"): it unblocks the theming and tenant-model work by making the
host-header → tenant path observable.

Checklist (AFK where possible; hand the human precise steps where dashboard access is needed):

- Confirm the almighty-warrior**s**? slug against prod tenant data (`pnpm *:prod` CLIs / Convex
  prod tables) before creating DNS records — the scoping README says `almighty-warrior`, the
  user's invocation said `almighty-warriors`.
- Cloudflare DNS (my-course.app is Cloudflare-registered): either a wildcard
  `*.my-course.app` CNAME to Vercel or four explicit records — prefer wildcard (future tenants
  free), note the choice.
- Vercel project domains: add the wildcard (or four subdomains) to the prod project; verify TLS
  issues certs for each host.
- Verify each host serves the app (200, correct TLS) — until the tenant-resolution middleware
  exists they will all render the default site, which is fine.
- Local dev story is **not** this ticket (lives in
  [Tenant & subdomain model](02-scope-tenant-subdomain-model.md)).

Resolution records: the DNS mechanism chosen (wildcard vs explicit), the confirmed tenant slugs,
and the four live URLs.
