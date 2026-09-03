// The OAuth sign-in redirect guard. (Plain module, no Convex functions registered
// here.) Split out of `lib.ts` by technical-foundation/16, into the module its
// existing test file `authRedirect.test.ts` was already named for.

// Where an OAuth sign-in is allowed to land, given the client-supplied
// `redirectTo` and the deployment's SITE_URL. Wired in as Convex Auth's
// `callbacks.redirect` (convex/auth.ts) because the library's default only ever
// admits SITE_URL itself, and falls back to it when `redirectTo` is absent
// (@convex-dev/auth implementation/redirects.js). Both are wrong for us now:
// `https://ywampotch.my-course.app` does not start with `https://my-course.app`,
// so a tenant sign-in would either throw or land the user on the apex — and under
// ADR 0025 the session cookie is host-only, so the host the callback redirects to
// IS the host they end up signed in on. Landing on the apex means the buyer who
// started on the tenant subdomain is still signed out there.
//
// The rule: same origin as SITE_URL, or any single- or multi-label subdomain of
// its apex. No tenant allow-list, deliberately — every `*.my-course.app` name is
// the operator's own DNS to hand out, so DNS control is the trust boundary and
// adding a tenant needs no change here. `www.` is stripped from the base because
// tenant hosts hang off the apex, matching `appUrl` in payfast.ts.
//
// `redirectTo` is untrusted client input, so this is a real open-redirect guard:
// the URL it returns carries a one-time session code as a query param
// (implementation/index.js), and handing that to a foreign host hands over the
// sign-in. Anything not provably ours throws rather than falling back to a
// plausible-looking default.
export function oauthRedirectUrl(redirectTo: string, siteUrl: string): string {
  const invalid = () => new Error(`Invalid \`redirectTo\` ${redirectTo} for SITE_URL ${siteUrl}`);
  let site: URL;
  try {
    site = new URL(siteUrl);
  } catch {
    throw new Error(`SITE_URL is not a valid URL: ${siteUrl}`);
  }
  // A leading `//` is protocol-relative, NOT a path: `new URL("//evil.com", site)`
  // resolves to `https://evil.com/`. Reject before resolving so it can never be
  // mistaken for the relative case below.
  if (redirectTo.startsWith("//")) throw invalid();
  let resolved: URL;
  try {
    resolved = new URL(redirectTo, site);
  } catch {
    throw invalid();
  }
  if (resolved.protocol !== site.protocol || resolved.port !== site.port) throw invalid();
  const apex = site.hostname.replace(/^www\./, "");
  const host = resolved.hostname;
  // The dot boundary is what stops `my-course.app.evil.com` passing a suffix test.
  if (host !== apex && host !== site.hostname && !host.endsWith(`.${apex}`)) throw invalid();
  return resolved.toString();
}
