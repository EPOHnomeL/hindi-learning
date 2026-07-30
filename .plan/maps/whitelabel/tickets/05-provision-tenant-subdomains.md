---
type: task
blocked_by: []
---
# Provision the four tenant subdomains

## Question

Make `upf.my-course.app`, `ywampotch.my-course.app`, `almighty-warrior(s).my-course.app`, and
`yknot.my-course.app` resolve to the production app, so per-subdomain styling can be developed and
demoed against real hosts. Execution carried in-map by user instruction — it unblocks theming and
tenant-model work by making the host-header → tenant path observable. Checklist:

- Confirm the `almighty-warrior(s)` slug against prod tenant data before creating DNS records
  (scoping README said singular; the user's invocation said plural).
- Cloudflare DNS: wildcard `*.my-course.app` CNAME vs four explicit records — prefer wildcard, note
  the choice.
- Vercel project domains: add the wildcard (or four subdomains) to the prod project; verify TLS.
- Verify each host serves the app (200, correct TLS) — all render the default site until
  tenant-resolution middleware exists, which is fine.
- Local dev story is **not** this ticket (lives in 02).

## Done when

The DNS mechanism is chosen and recorded, the tenant slugs are confirmed, and all four
`<slug>.my-course.app` hosts return 200 over HTTPS with valid certs (rendering the default site).

## Answer

Done 2026-07-15 — user executed the checklist. All four hosts are **live over HTTPS with valid
TLS**, verified by fetching each: upf / ywampotch / almighty-warriors / yknot `.my-course.app`.

- **Slugs confirmed:** `upf`, `ywampotch`, `almighty-warriors` (**plural** — user's call,
  supersedes the singular in the scoping README), `yknot`.
- **DNS approach: four explicit CNAMEs, not a wildcard** — simplest on Cloudflare (each subdomain
  added to Vercel gets its own cert via CNAME validation, no wildcard-cert TXT dance). A future
  5th tenant is one more CNAME + one more Vercel domain. Fits the four-known-tenants reality.
- Records are four `cname.vercel-dns.com` CNAMEs on Cloudflare (DNS-only / grey cloud so Vercel
  terminates TLS); domains attached to the Vercel `hindi-learning` project
  (`prj_EpTp3OY6HHRta6NDxbVrNHpc719d`). Base domain `my-course.app`/`www` were already live, so
  adding subdomains was purely additive. No conflicts.

Each currently renders the default site (title "My Course") — correct, since tenant-resolution
middleware doesn't exist yet (ticket 02).
