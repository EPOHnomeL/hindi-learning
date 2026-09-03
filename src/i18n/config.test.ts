import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, resolveLocale, withLocaleCookie } from "./config";

// The chrome offer-set is locked by ticket 04: exactly the locales that have a
// `messages/<code>.json` file (en/af/es/fr/hi/ur; Urdu joined 2026-09-03). resolveLocale is the pure guard
// `getRequestConfig` wraps around the cookie so an absent/unknown value can never
// select a message file that doesn't exist (the "picks Telugu, gets English"
// broken state the map calls out).
describe("resolveLocale", () => {
  it("keeps a cookie value that is an offered locale", () => {
    for (const code of LOCALES) {
      expect(resolveLocale(code)).toBe(code);
    }
  });

  it("falls back to English when the cookie is absent", () => {
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("")).toBe(DEFAULT_LOCALE);
  });

  it("falls back to English for a code with no message file (e.g. Telugu)", () => {
    expect(resolveLocale("te")).toBe("en");
    expect(resolveLocale("garbage")).toBe("en");
  });

  it("offers exactly en/af/es/fr/hi/ur and defaults to English", () => {
    expect([...LOCALES].sort()).toEqual(["af", "en", "es", "fr", "hi", "ur"]);
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALES).toContain(DEFAULT_LOCALE);
  });
});

// The middleware stamps the forwarded Cookie header so the locale it derived is
// the one THIS request renders in. Since 2026-09-03 that stamp can be an override
// of a stored value (a Public link), so replacing the existing pair rather than
// appending after it is the whole point: `cookies()` reads the first occurrence.
describe("withLocaleCookie", () => {
  it("adds the locale cookie to a header that has none", () => {
    expect(withLocaleCookie("theme=dark", "hi")).toBe("theme=dark; hindi_lang=hi");
  });

  it("handles an absent or empty header without a stray separator", () => {
    expect(withLocaleCookie(null, "es")).toBe("hindi_lang=es");
    expect(withLocaleCookie(undefined, "es")).toBe("hindi_lang=es");
    expect(withLocaleCookie("", "es")).toBe("hindi_lang=es");
  });

  it("replaces a stored value instead of appending a second pair", () => {
    expect(withLocaleCookie("hindi_lang=en", "hi")).toBe("hindi_lang=hi");
    expect(withLocaleCookie("a=1; hindi_lang=en; b=2", "hi")).toBe("a=1; b=2; hindi_lang=hi");
  });

  it("leaves cookies whose names merely start the same alone", () => {
    // `hindi_lang_x` and the content-language key are different cookies.
    expect(withLocaleCookie("hindi_share_lang=tok:hi", "hi")).toBe("hindi_share_lang=tok:hi; hindi_lang=hi");
  });
});
