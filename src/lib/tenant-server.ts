import { headers } from "next/headers";
import { resolveTenantSlug, TENANT_SLUG_HEADER, type TenantSlug } from "./tenant";

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
