import { headers } from "next/headers";
import { fetchQuery } from "convex/nextjs";
import { resolveTenantSlug, TENANT_SLUG_HEADER, type TenantSlug } from "./tenant";
import { api } from "../../convex/_generated/api";

// The resolved tenant for the current request, for server components (root
// layout, cross-host redirect, dashboard scope). Reads the header the middleware
// stamped — the single edge resolution point — but falls back to parsing the Host
// header directly, so a server component always gets the right answer even if the
// header didn't survive Convex Auth's middleware response re-wrap. Server-only:
// `next/headers` throws if imported into client code.
export async function getTenantSlug(): Promise<TenantSlug | null> {
  const h = await headers();
  return resolveTenantSlug(h.get(TENANT_SLUG_HEADER) ?? h.get("host"));
}

// The resolved tenant's frontend view for the current request (issue 11): the
// first server-side Convex fetch in the app. Returns `null` for the default site
// (no tenant slug) — callers skip the theme override and render the shipped
// defaults. Both server consumers call it (the root layout for the no-flash
// palette, `generateMetadata` for the favicon); the per-request read is one tiny
// indexed lookup, so it stays uncached in this pass (decision 03 #5 / issue 11).
export async function getTenantView() {
  const slug = await getTenantSlug();
  if (!slug) return null;
  try {
    return await fetchQuery(api.tenantTheme.getTheme, { slug });
  } catch (err) {
    // This fetch sits in the root layout, so it runs on every route. A theme read
    // is best-effort branding, never access control — so a transient Convex error
    // (or the query not yet being deployed) must degrade to the default skin, not
    // 500 the whole site. Log it so the failure is still visible.
    console.error(`getTenantView: failed to resolve theme for tenant "${slug}"`, err);
    return null;
  }
}
