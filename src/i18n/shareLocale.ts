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
// Scope, widened 2026-09-03 (it was first-touch only until then, which meant any
// device that had ever resolved a locale opened a Hindi link in English chrome,
// including every owner testing their own links): the Edition language now wins on
// EVERY request under `/share/<token>`, stored cookie or not. It is applied by
// stamping the forwarded `Cookie` header for that request only, and persisted to
// the device (`Set-Cookie`) just on a first touch as before, so reading one Hindi
// link never rewrites the app-language the visitor chose for the rest of the site.
//
// The Guest reader carries no app-language picker, so there is no pick under these
// paths for the override to fight; if one is ever added there, it needs the
// provenance this deliberately does without (the cookie records a value, not who
// wrote it).

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

// The per-device memo of the last token to locale lookup. Without it the override
// above would re-run `publicEditionLang` in the middleware on every page a Guest
// turns, serially ahead of the response. The old first-touch policy paid for one
// lookup because the locale cookie it wrote ended the question. Keyed by token, so
// a regenerated link re-reads; a browser-session cookie (no max-age), so nothing
// about a stale Edition language can outlive the visit.
export const SHARE_LOCALE_COOKIE = "hindi_share_lang";

export function shareLocaleMemo(token: string, locale: Locale): string {
  return `${encodeURIComponent(token)}:${locale}`;
}

// The memoed locale for `token`, or null when the memo is absent, malformed, for a
// different token, or for a code we no longer ship chrome for.
export function readShareLocaleMemo(value: string | undefined | null, token: string): Locale | null {
  if (!value) return null;
  const cut = value.lastIndexOf(":");
  if (cut < 0) return null;
  if (value.slice(0, cut) !== encodeURIComponent(token)) return null;
  return offeredLocale(value.slice(cut + 1));
}
