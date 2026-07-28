import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { offeredLocale, type Locale } from "./config";

// Cookie-writer #3's Public-link half. A Guest arriving on `/share/<token>` holds
// a link to exactly ONE Edition (course-translation), so the language that
// Edition is written in is the strongest signal we have about the language they
// read — stronger than `Accept-Language`, which for many non-English speakers
// still says `en` (a borrowed laptop, a phone shipped in English). So a Hindi link
// paints Hindi chrome, and the middleware persists it as the device's app-language
// exactly as a sniff or a pick would.
//
// Deliberately first-touch only (see the middleware): this widens what a *first*
// visit resolves to and never overrides a locale the visitor or their browser has
// already established.

// The Public-link token in a request path, or null when this isn't a Guest reader
// URL. The Guest reader is `src/app/share/[token]` — `/share/<token>` plus
// `/lessons/<key>` and `/references/<key>` under it — so the token is always the
// segment right after `share`.
export function shareTokenFromPath(pathname: string): string | null {
  const [, first, token] = pathname.split("/");
  return first === "share" && token ? decodeURIComponent(token) : null;
}

// The chrome locale a Public link implies, or null when there isn't one: an
// unknown/revoked token, or an Edition language we ship no `messages/<code>.json`
// for (Telugu, `hi-Latn`, …). The caller falls back to the browser sniff.
//
// Never throws. This runs in the middleware, on the request path of every Guest's
// first paint — a nicety about which language the chrome is in must not be able to
// fail the page, so a Convex hiccup degrades to "no hint" and the sniff decides.
export async function shareEditionLocale(token: string): Promise<Locale | null> {
  try {
    // Omit `url` (rather than passing it): convex/nextjs then defaults to
    // NEXT_PUBLIC_CONVEX_URL, and an explicitly-passed undefined logs a noisy
    // "deploymentUrl is undefined" error even though it falls back to the same.
    const lang = await fetchQuery(api.public.publicEditionLang, { token });
    return offeredLocale(lang);
  } catch {
    return null;
  }
}
