import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, resolveLocale } from "./config";

// The chrome offer-set is locked by ticket 04: exactly the locales that have a
// `messages/<code>.json` file (en/af/es/fr/hi). resolveLocale is the pure guard
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

  it("offers exactly en/af/es/fr/hi and defaults to English", () => {
    expect([...LOCALES].sort()).toEqual(["af", "en", "es", "fr", "hi"]);
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALES).toContain(DEFAULT_LOCALE);
  });
});
