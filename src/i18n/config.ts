// The chrome i18n offer-set and the locale-resolution guard.
//
// Locked by ticket 04: the set of chrome languages IS the set of
// `messages/<code>.json` files that exist — NOT the ~130-entry content picker in
// `convex/languages.ts`. This constant is that set; `convex/languages.ts` only
// supplies display/native names for these codes (via `langInfo`). Adding the 6th
// chrome language is: drop `messages/<code>.json`, add the code here. The parity
// test (`messages/parity.test.ts`) keeps every file's keys in lockstep with
// `en.json`; this array keeps the app's offer-set in lockstep with the files.
export const LOCALES = ["en", "af", "es", "fr", "hi", "ur"] as const;

export type Locale = (typeof LOCALES)[number];

// English is the source of truth and the universal fallback (ticket 04/05).
export const DEFAULT_LOCALE: Locale = "en";

// The cookie `getRequestConfig` reads on every request — the sole render source
// of truth (ticket 03). Underscore (not the `hindi:*` colon the reader's
// localStorage keys use): a colon is not a valid RFC 6265 cookie-name token, and
// this is distinct from `hindi:lang` (the content-Edition preference) regardless.
//
// Written **host-only** (no `Domain`), so each tenant subdomain keeps its own app
// language (ADR 0025). Renamed from `hindi_locale` alongside that change, and the
// rename is load-bearing: the old parent-domain cookie is still in browsers with a
// year of max-age, and a host-only cookie of the SAME name would not replace it —
// the browser keeps both, sends both, and the stale shared value can win forever.
export const LOCALE_COOKIE = "hindi_lang";

// A long-lived persistent cookie (ticket 03 §2): the app-language is a durable
// device preference, so it outlives the session like the theme does. One year,
// shared by every writer (middleware sniff + client pick) so the cookie's
// lifetime never depends on which path wrote it.
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Coerce a raw cookie value into an offered locale, English otherwise. Wrapping
// the cookie in this guard stops an absent or unknown code from selecting a
// message file that doesn't exist ("picks Telugu, silently gets English", ticket
// 04) — an unoffered code resolves to English deliberately, not by import crash.
export function resolveLocale(value: string | undefined | null): Locale {
  return offeredLocale(value) ?? DEFAULT_LOCALE;
}

// The same offer-set test, but "offered, or nothing" instead of "offered, or
// English" — for callers that have a *further* fallback and so must tell the two
// apart. The Public-link adoption (i18n/shareLocale.ts) is one: an Edition
// language we don't ship chrome for must fall through to the browser's
// Accept-Language, not straight to English. Note this matches whole codes only,
// so a romanized Edition (`hi-Latn`) is deliberately NOT Hindi chrome — someone
// reading Hindi in Latin letters is exactly the reader Devanagari chrome fails.
export function offeredLocale(value: string | undefined | null): Locale | null {
  return value && (LOCALES as readonly string[]).includes(value) ? (value as Locale) : null;
}

// Rewrite a forwarded `Cookie` header so `getRequestConfig` sees `locale` for THIS
// request. Cookie-writer #3 (the middleware) stamps the header as well as setting
// the cookie, so a derived language paints on the first response with no flash.
//
// Any existing pair for the locale cookie is dropped rather than appended after:
// a header carrying the name twice is ambiguous, and `cookies()` reads the FIRST
// occurrence, so appending would be silently ignored whenever the stamp is an
// override of a stored value (which a Public link now is, 2026-09-03).
export function withLocaleCookie(header: string | null | undefined, locale: Locale): string {
  const kept = (header ?? "")
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair !== "" && pair.split("=")[0]?.trim() !== LOCALE_COOKIE);
  return [...kept, `${LOCALE_COOKIE}=${locale}`].join("; ");
}
