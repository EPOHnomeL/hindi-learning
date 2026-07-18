import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";
import { resolveTenantSlug, TENANT_SLUG_HEADER } from "./lib/tenant";

// Convex Auth keeps the session in sync across server/client for the App Router.
// The custom handler resolves the whitelabel tenant from the Host header and
// forwards it to server components as `x-tenant-slug` (ADR 0021 §6). Convex Auth
// ports its auth cookies onto whatever response the handler returns.
//
// Pass convexUrl explicitly: the auth proxy otherwise forwards `url: undefined`
// to convex/nextjs, which logs a noisy "deploymentUrl is undefined" error even
// though it falls back to NEXT_PUBLIC_CONVEX_URL. Next inlines this at build.
export default convexAuthNextjsMiddleware(
  (request) => {
    const headers = new Headers(request.headers);
    // Never trust an inbound value — a client must not be able to force a skin by
    // sending its own x-tenant-slug. Resolution is from the Host header only.
    headers.delete(TENANT_SLUG_HEADER);
    const slug = resolveTenantSlug(request.headers.get("host"));
    if (slug) headers.set(TENANT_SLUG_HEADER, slug);
    // Server components can't read the request URL directly, so stamp it here for
    // the course layout's cross-host canonical redirect (issue 18) to reconstruct
    // path + query when it swaps the host. Cheap and additive; consumed only there.
    headers.set("x-url", request.url);
    return NextResponse.next({ request: { headers } });
  },
  { convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL },
);

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
