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
