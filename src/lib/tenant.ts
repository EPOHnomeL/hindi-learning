// Whitelabel tenant resolution (issue 10 / ADR 0021 §6). The ONE place that
// answers "which tenant is this request for", from the request Host. Pure and
// dependency-free so it runs anywhere — middleware (edge), server components,
// client. A resolved slug only selects catalogue + skin; every privileged action
// stays guarded server-side by identity, never by this value (ADR 0021 §6).

// The known tenant subdomains. Static by design (ponytail / ADR 0021 §6): adding
// a tenant is an operator task — a CNAME + Vercel domain (ticket 05) + a seeded
// `tenants` row (scripts/seed-tenants.ts) + an entry here — not a per-request
// Convex read on the hot middleware path. Keep in sync with the seed script.
export const TENANT_SLUGS = ["upf", "ywampotch", "almighty-warriors", "yknot"] as const;
export type TenantSlug = (typeof TENANT_SLUGS)[number];

// The request header the middleware stamps with the resolved slug, read back by
// server components (see tenant-server.ts). Shared so the writer and reader can't
// drift on the name.
export const TENANT_SLUG_HEADER = "x-tenant-slug";

const KNOWN = new Set<string>(TENANT_SLUGS);

// Resolve a Host header to a tenant slug: strip any port, lowercase, take the
// leftmost dot-label, and match against the known set. Bare `my-course.app`,
// `www.*`, `localhost`, and any unrecognised subdomain → null (the default site).
export function resolveTenantSlug(host: string | null | undefined): TenantSlug | null {
  if (!host) return null;
  const label = host.split(":")[0]?.trim().toLowerCase().split(".")[0];
  return label && KNOWN.has(label) ? (label as TenantSlug) : null;
}

// The cross-host canonical redirect (issue 18 / ADR 0022 §3). A course's canonical
// host is its `<tenant>` subdomain when the course is tenanted, else the default
// site (the apex, no subdomain). Given the current request URL and the course's
// canonical tenant, return the absolute URL the request should be redirected to —
// same path, query, and port, only the host swapped — or `null` when the request
// is already on the canonical host.
//
// The `null` no-op is load-bearing: links are minted canonical by construction, so
// this net is rarely hit; returning `null` for the already-canonical case is what
// guarantees no redirect loop. Pure, so the whole decision is unit-tested.
// The href of a course's tenant portal — its front door on its canonical host
// (welcome/01). Relative "/" when the reader is already there (the common case:
// links are minted canonical), else the absolute tenant home.
//
// This exists for the Guest reader specifically: `/share/<token>` has no
// canonical-host bounce (only the authed course layout does), so a Public link
// opened on the apex renders a tenanted course under the default skin — where "/"
// would send the Guest to the wrong front door. Path/query/hash are dropped: the
// destination is the portal home, and the Public link token must never ride along
// into a link the Guest might share on (ADR 0013).
export function tenantHomeHref(currentUrl: string, courseTenant: TenantSlug | null): string {
  const canonical = canonicalRedirect(currentUrl, courseTenant);
  if (!canonical) return "/";
  const url = new URL(canonical);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function canonicalRedirect(currentUrl: string, courseTenant: TenantSlug | null): string | null {
  const url = new URL(currentUrl);
  // Strip an existing known-tenant label to find the base domain (`my-course.app`
  // or `localhost`), then re-attach the course's tenant (or none for the default).
  //
  // A leading `www` is stripped ONLY when re-attaching a tenant: without it a tenant
  // link off `www.my-course.app` would mint the unresolvable `<tenant>.www…`. But for
  // the default site (untenanted), `www` and the apex BOTH serve it — forcing one
  // over the other fights the host-level www↔apex canonicalization (Cloudflare) and
  // produces an endless redirect loop, so we leave the host as-is.
  const first = url.hostname.split(".")[0];
  const strippable = !!first && (KNOWN.has(first) || (first === "www" && courseTenant !== null));
  const base = strippable ? url.hostname.slice(first.length + 1) : url.hostname;
  const target = courseTenant ? `${courseTenant}.${base}` : base;
  if (target === url.hostname) return null;
  url.hostname = target;
  return url.toString();
}
