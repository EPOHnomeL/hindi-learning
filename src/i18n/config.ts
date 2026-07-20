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
// of truth (ticket 03). Namespaced to sit beside the reader's `hindi:*` client
// keys without colliding with `hindi:lang` (the content-Edition preference).
export const LOCALE_COOKIE = "hindi:locale";

// Coerce a raw cookie value into an offered locale, English otherwise. Wrapping
// the cookie in this guard stops an absent or unknown code from selecting a
// message file that doesn't exist ("picks Telugu, silently gets English", ticket
// 04) — an unoffered code resolves to English deliberately, not by import crash.
export function resolveLocale(value: string | undefined | null): Locale {
  return value && (LOCALES as readonly string[]).includes(value)
    ? (value as Locale)
    : DEFAULT_LOCALE;
}
