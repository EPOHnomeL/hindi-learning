# whitelabel/05: Provision the four tenant subdomains

**Status:** done
**Depends on:** —
**Labels:** wayfinder:task
**Claimed:** jonathan (opus session, 2026-07-15)

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

---

## Decisions (2026-07-15)

- **Slugs confirmed**: `upf`, `ywampotch`, `almighty-warriors` (**plural** — user's call, supersedes
  the singular in the scoping README), `yknot`.
- **DNS approach**: **four explicit CNAMEs**, not a wildcard. Simplest on Cloudflare — each
  subdomain added to Vercel gets its own cert via CNAME validation, no wildcard-cert TXT dance.
  A future 5th tenant is one more CNAME + one more Vercel domain. Fits the four-known-tenants
  reality (ponytail).
- **Current infra state** (verified via Vercel MCP, 2026-07-15): the Vercel project is
  `hindi-learning` (`prj_EpTp3OY6HHRta6NDxbVrNHpc719d`, team `team_pWPZwRSNsgPwZhgfoED4podg`).
  Its domains already include `my-course.app` and `www.my-course.app`, so the base domain is
  live on the app and adding subdomains is purely additive. DNS for `my-course.app` is on
  Cloudflare.

## Handoff checklist (HITL — no Cloudflare/Vercel domain tooling available to the agent)

**1. Cloudflare → my-course.app → DNS → Records.** Add four CNAMEs, each **DNS only (grey
cloud, not proxied)** — Vercel must terminate TLS itself:

| Type  | Name                | Target                  | Proxy    |
|-------|---------------------|-------------------------|----------|
| CNAME | `upf`               | `cname.vercel-dns.com`  | DNS only |
| CNAME | `ywampotch`         | `cname.vercel-dns.com`  | DNS only |
| CNAME | `almighty-warriors` | `cname.vercel-dns.com`  | DNS only |
| CNAME | `yknot`             | `cname.vercel-dns.com`  | DNS only |

**2. Vercel → hindi-learning project → Settings → Domains.** Add each of:
`upf.my-course.app`, `ywampotch.my-course.app`, `almighty-warriors.my-course.app`,
`yknot.my-course.app`. Each should go "Valid Configuration" once the CNAME resolves and the
cert issues (seconds-to-minutes).

**3. Verify** each host returns 200 over HTTPS with a valid cert. Until the tenant-resolution
middleware exists (ticket 02), all four will render the **default site** — that is expected and
correct; this ticket only makes the hosts resolve.

## Resolved (2026-07-15)

Done — user executed the checklist. All four hosts are **live over HTTPS with valid TLS**,
verified by fetching each:

- <https://upf.my-course.app>
- <https://ywampotch.my-course.app>
- <https://almighty-warriors.my-course.app>
- <https://yknot.my-course.app>

Each currently renders the **default site** (the app shell, title "My Course") — correct, since
tenant-resolution middleware doesn't exist yet ([ticket 02](02-scope-tenant-subdomain-model.md)).
DNS: four explicit `cname.vercel-dns.com` CNAMEs on Cloudflare (DNS-only); domains attached to the
Vercel `hindi-learning` project. No conflicts reported.
