import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";
import { resolveTenantSlug, TENANT_SLUG_HEADER } from "./lib/tenant";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, withLocaleCookie } from "./i18n/config";
import { matchAcceptLanguage } from "./i18n/acceptLanguage";
import {
  editionHint,
  editionHintLocale,
  editionHintScope,
  readShareLocaleMemo,
  shareLocaleMemo,
  SHARE_LOCALE_COOKIE,
} from "./i18n/shareLocale";
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
  async (request) => {
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

    // NOTE for regional pricing (ywampotch-launch ticket 11): the buyer's
    // country needs NO stamp here. Unlike `x-tenant-slug` (derived from Host)
    // and `x-url` (invisible to server components), `x-vercel-ip-country` is
    // already on the incoming request and Vercel overwrites it at the edge, so
    // a checkout server component reads it straight from `headers()` and passes
    // it to Convex as an argument — Convex runs off Vercel and can never see it
    // itself. Absent on localhost, which resolves to the base price by design.

    // Cookie-writer #3 (app-language-i18n ticket 03 §3): resolve an offered locale
    // from the request itself, stamp it onto the forwarded Cookie header so it is
    // visible to THIS request's getRequestConfig (a Spanish browser lands in Spanish
    // chrome on first paint, no flash), and persist it so the negotiation does not
    // re-run. An explicit pick always overrides later.
    //
    // Two signals, in this order:
    //   1. the Edition language of the course being read, from EITHER public
    //      entrance (i18n/shareLocale.ts): the `/share/<token>` link, and since
    //      2026-09-08 the course's own `/courses/<slug>` URL, which serves the same
    //      Guest reader for a published, priced Edition. A Guest reading that
    //      Edition reads its language, and before 2026-09-03 being first-touch only
    //      meant any device with a stored locale, every owner checking their own
    //      link included, read a Hindi link in English chrome.
    //      Under `/share` it is applied per request, NOT persisted over a stored
    //      locale, so it never rewrites the language the visitor picked for the rest
    //      of the site. Under `/courses` it is first-touch ONLY, because a
    //      signed-in reader with an app-language picker reads at that same URL and
    //      their pick has to stay sovereign (see shareLocale.ts for the full
    //      reasoning). The lookup is memoised per Edition in a session cookie, so
    //      turning pages inside the reader costs no extra Convex read.
    //   2. Accept-Language, the browser's own claim (English if nothing matches).
    //      First-touch only: it can never override a stored locale.
    const stored = request.cookies.get(LOCALE_COOKIE)?.value;
    const hint = editionHint(request.nextUrl.pathname, request.nextUrl.searchParams.get("lang"), !!stored);
    const scope = hint ? editionHintScope(hint) : null;
    const memo = scope ? request.cookies.get(SHARE_LOCALE_COOKIE)?.value : undefined;
    const memoed = scope ? readShareLocaleMemo(memo, scope) : null;
    const hinted = hint ? (memoed ?? (await editionHintLocale(hint))) : null;
    const derived = hinted ?? (stored ? null : matchAcceptLanguage(request.headers.get("accept-language")));
    if (derived && derived !== stored) {
      headers.set("cookie", withLocaleCookie(headers.get("cookie"), derived));
    }

    const response = NextResponse.next({ request: { headers } });
    // Persist only what the device has no answer for yet: a first touch becomes the
    // durable app-language, a Public link opened by a device that already has one
    // stays scoped to the request stamped above.
    if (derived && !stored) {
      response.cookies.set(LOCALE_COOKIE, derived, {
        path: "/",
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: "lax",
        // No `domain`: host-only, so each tenant subdomain sniffs and keeps its own
        // language (ADR 0025). Next defaults an omitted domain to host-only.
      });
    }
    // Memoise the Edition lookup for the rest of the visit (browser-session cookie,
    // no max-age). Skipped when the memo already says this, so the header is not
    // re-sent on every page of the reader.
    if (scope && hinted && !memoed) {
      response.cookies.set(SHARE_LOCALE_COOKIE, shareLocaleMemo(scope, hinted), {
        path: "/",
        sameSite: "lax",
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
