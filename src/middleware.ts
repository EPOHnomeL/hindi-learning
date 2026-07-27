import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";
import { resolveTenantSlug, TENANT_SLUG_HEADER } from "./lib/tenant";
import { cookieDomainFor } from "./lib/cookieDomain";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "./i18n/config";
import { matchAcceptLanguage } from "./i18n/acceptLanguage";
import { AUTH_COOKIE_MAX_AGE_SECONDS } from "./lib/sessionLifetime";

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

    // Cookie-writer #3 (app-language-i18n ticket 03 §3): first visit, nothing
    // stored → sniff Accept-Language ONCE, map to an offered locale (else
    // English), and persist so the negotiation never re-runs. Stamping the
    // forwarded Cookie header makes it visible to THIS request's getRequestConfig,
    // so a Spanish browser lands in Spanish chrome on first paint (no flash); the
    // Set-Cookie below makes it durable. An explicit pick always overrides later.
    const sniffed = request.cookies.get(LOCALE_COOKIE)
      ? null
      : matchAcceptLanguage(request.headers.get("accept-language"));
    if (sniffed) {
      const existing = headers.get("cookie");
      headers.set("cookie", existing ? `${existing}; ${LOCALE_COOKIE}=${sniffed}` : `${LOCALE_COOKIE}=${sniffed}`);
    }

    const response = NextResponse.next({ request: { headers } });
    if (sniffed) {
      response.cookies.set(LOCALE_COOKIE, sniffed, {
        path: "/",
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: "lax",
        // Scope to the shared parent domain so the picked UI language survives a
        // subdomain switch (undefined → host-only, the dev/preview default).
        domain: cookieDomainFor(request.headers.get("host")),
      });
    }
    return response;
  },
  {
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
    // Without an explicit `maxAge` Convex Auth writes the JWT and refresh-token
    // cookies as *browser-session* cookies, so quitting the browser signs the user
    // out even though the server-side session is still valid for months (issue
    // 110). Must stay >= the `session` durations in convex/auth.ts — see
    // lib/sessionLifetime.ts.
    cookieConfig: { maxAge: AUTH_COOKIE_MAX_AGE_SECONDS },
  },
);

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
