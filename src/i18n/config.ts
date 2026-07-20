// The chrome i18n offer-set and the locale-resolution guard.
//
// Locked by ticket 04: the set of chrome languages IS the set of
// `messages/<code>.json` files that exist — NOT the ~130-entry content picker in
// `convex/languages.ts`. This constant is that set; `convex/languages.ts` only
// supplies display/native names for these codes (via `langInfo`). Adding the 6th
// chrome language is: drop `messages/<code>.json`, add the code here. The parity
// test (`messages/parity.test.ts`) keeps every file's keys in lockstep with
// `en.json`; this array keeps the app's offer-set in lockstep with the files.
export const LOCALES = ["en", "af", "es", "fr", "hi"] as const;

export type Locale = (typeof LOCALES)[number];

// English is the source of truth and the universal fallback (ticket 04/05).
export const DEFAULT_LOCALE: Locale = "en";

// The cookie `getRequestConfig` reads on every request — the sole render source
// of truth (ticket 03). Underscore (not the `hindi:*` colon the reader's
// localStorage keys use): a colon is not a valid RFC 6265 cookie-name token, and
// this is distinct from `hindi:lang` (the content-Edition preference) regardless.
export const LOCALE_COOKIE = "hindi_locale";

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
  return value && (LOCALES as readonly string[]).includes(value)
    ? (value as Locale)
    : DEFAULT_LOCALE;
}
