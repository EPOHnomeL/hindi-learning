// One place that answers "which Domain should a cross-subdomain cookie carry?".
//
// The whitelabel tenants share one deployment on `<slug>.my-course.app`. For a
// sign-in, chosen theme, and chosen UI language to survive switching between
// subdomains, their cookies must be scoped to the registrable parent domain
// (`Domain=my-course.app`) instead of the default host-only scope — otherwise
// every subdomain is a fresh cookie origin (re-sign-in, reset settings).
//
// The parent domain is configured, not guessed: `NEXT_PUBLIC_COOKIE_DOMAIN`
// (e.g. `my-course.app`). Leaving it unset keeps cookies host-only — the safe
// default for local dev and for Vercel preview hosts (`*.vercel.app` is a public
// suffix and would reject a `Domain` attribute, silently dropping the cookie).
// The same value drives the Convex Auth cookie patch (patches/@convex-dev+auth);
// keep them in sync.
//
// Pure and dependency-free so it runs in edge middleware, server components, and
// the browser alike. Read inside the function (not a cached const): the literal
// `process.env.NEXT_PUBLIC_COOKIE_DOMAIN` is still inlined into the client bundle,
// and the per-call read keeps the tests able to toggle it.
export function configuredCookieDomain(): string | undefined {
  return process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;
}

// Return the Domain attribute for a cookie set on `host`, or undefined to leave
// the cookie host-only. We only attach the parent domain when the request host
// actually belongs to it (the apex itself or one of its subdomains); any other
// host (preview, localhost, an unexpected domain) stays host-only.
export function cookieDomainFor(host: string | null | undefined): string | undefined {
  const base = configuredCookieDomain();
  if (!base) return undefined;
  const h = host?.split(":")[0]?.trim().toLowerCase();
  if (!h) return undefined;
  return h === base || h.endsWith(`.${base}`) ? base : undefined;
}
