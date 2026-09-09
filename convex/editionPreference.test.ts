/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { preferEdition } from "./editionPreference";
import { SOURCE_LANG } from "./sourceLang";

// The Edition-preference ladder, which was spelled five times before 2026-09-08:
// three byte-identical copies in `Dashboard.tsx` and two on the server computing
// a card title from the same ladder minus its top rung.

test("the UI locale wins when the caller holds that Edition", () => {
  expect(preferEdition(["en", "es"], "es")).toBe("es");
  expect(preferEdition(["es", "ur"], "ur")).toBe("ur");
});

test("a locale the caller does not hold falls through to the source Edition", () => {
  expect(preferEdition(["en", "es"], "fr")).toBe(SOURCE_LANG);
});

test("without the source Edition it falls through to whatever they hold first", () => {
  expect(preferEdition(["es", "ur"], "fr")).toBe("es");
  // An English-only Viewer of a Spanish-only share: the card must be titled in
  // Spanish, not in an English they were never granted.
  expect(preferEdition(["es"])).toBe("es");
});

test("no Edition at all is undefined rather than a guess", () => {
  // A real state for a card caught mid-revocation.
  expect(preferEdition([])).toBeUndefined();
  expect(preferEdition([], "es")).toBeUndefined();
});

test("omitting the locale drops the top rung, which is what the server does", () => {
  // The honest difference between the two sides. A server query titling a card
  // has no idea what UI language the browser is in.
  expect(preferEdition(["en", "es"])).toBe(SOURCE_LANG);
  expect(preferEdition(["en", "es"], "es")).toBe("es");
});

test("nobody re-derives the ladder by hand", () => {
  const files = {
    ...(import.meta.glob("./**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>),
    ...(import.meta.glob("../src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<
      string,
      string
    >),
  };
  const offenders = Object.entries(files)
    .filter(([p]) => !p.includes(".test.") && p !== "./editionPreference.ts")
    // The shape all five copies had: a source-language check with a first-held
    // fallback on the same line, or the client's `some(...) ? locale :` opener.
    .filter(([, s]) => /includes\(SOURCE_LANG\) \? SOURCE_LANG :/.test(s) || /\.lang === locale\)\s*\r?\n?\s*\? locale/.test(s))
    .map(([p]) => p);
  expect(offenders).toEqual([]);
});
