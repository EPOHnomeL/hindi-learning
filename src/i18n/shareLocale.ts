import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { offeredLocale, type Locale } from "./config";
import { guestRoute } from "../app/_components/guestSource";

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

// ---- The course-URL entrance (2026-09-08) --------------------------------
//
// `/courses/<slug>` serves the same Guest reader to a signed-out visitor when the
// Edition is published AND priced (convex/public.ts), so it deserves the same
// chrome hint: a stranger following a shared course link should not read a Hindi
// shopfront in English chrome.
//
// It differs from the `/share` half in ONE way, deliberately: it is **first touch
// only**, never a per-request override. `/share` can override a stored locale on
// every request because the Guest reader carries no app-language picker, so there
// is no pick for the override to fight. `/courses` is not like that: the very same
// URL is where a SIGNED-IN reader reads, and they do have a picker. Overriding
// there would silently undo their choice on every page they turn, and the cookie
// records a value rather than who wrote it, so nothing downstream could tell the
// two apart. First touch only keeps the picker sovereign and still gives a
// cookieless stranger the course's language on first paint.

// The Guest reader course path's slug, or null when the path is not one. The
// parser of record is `guestRoute` (app/_components/guestSource.ts), the same one
// the client uses to decide what to render, so `/courses/<slug>/manage` and every
// non-reader path are excluded here for free.
export function courseSlugFromPath(pathname: string): string | null {
  return guestRoute(pathname)?.slug ?? null;
}

// The chrome locale a public course URL implies, or null when there isn't one:
// a course whose slug entrance is shut (unpublished, or published and free), or an
// Edition language we ship no chrome for. Never throws, for the same reason
// `shareEditionLocale` doesn't.
export async function courseEditionLocale(slug: string, lang: string | null): Promise<Locale | null> {
  try {
    const served = await fetchQuery(api.public.publicCourseLang, { slug, ...(lang ? { lang } : {}) });
    return offeredLocale(served);
  } catch {
    return null;
  }
}

// ---- One hint for both entrances -----------------------------------------

// The Edition-language hint a request carries, if any. `hasStoredLocale` is what
// enforces the asymmetry above: a share token hints regardless, a course URL only
// on a device with no locale yet.
export type EditionHint = { kind: "share"; token: string } | { kind: "course"; slug: string; lang: string | null };

export function editionHint(pathname: string, lang: string | null, hasStoredLocale: boolean): EditionHint | null {
  const token = shareTokenFromPath(pathname);
  if (token) return { kind: "share", token };
  if (hasStoredLocale) return null;
  const slug = courseSlugFromPath(pathname);
  return slug ? { kind: "course", slug, lang } : null;
}

// The memo key for a hint. A course hint includes the requested language, because
// the same slug serves a different Edition under a different `?lang=`.
export function editionHintScope(hint: EditionHint): string {
  return hint.kind === "share" ? hint.token : `course:${hint.slug}:${hint.lang ?? ""}`;
}

export async function editionHintLocale(hint: EditionHint): Promise<Locale | null> {
  return hint.kind === "share"
    ? await shareEditionLocale(hint.token)
    : await courseEditionLocale(hint.slug, hint.lang);
}
