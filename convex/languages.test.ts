/// <reference types="vite/client" />
import { describe, expect, it, test } from "vitest";
import {
  LANGUAGES,
  editionChip,
  editionLabel,
  isDevanagari,
  isKnownLang,
  isRtl,
  langDir,
  langInfo,
  nonSourceEditionName,
} from "./languages";
import { SOURCE_LANG } from "./sourceLang";

// Romanized (-Latn) Editions: every non-Latin-script language in the picker has
// a Latin-script sibling, so a learner can read e.g. Hindi, Urdu, or Nepali in
// familiar letters instead of the native script.

// The full romanized menu — one -Latn code per non-Latin-script base language.
const ROMANIZED = LANGUAGES.filter((l) => l.code.split("-").includes("Latn"));

describe("romanized editions", () => {
  it("offers romanized Hindi, Urdu, and Nepali", () => {
    for (const code of ["hi-Latn", "ur-Latn", "ne-Latn"]) {
      expect(isKnownLang(code), code).toBe(true);
    }
  });

  it("offers a -Latn sibling for every non-Latin-script language in the menu", () => {
    const expected = [
      // Arabic script
      "ur-Latn", "ar-Latn", "fa-Latn", "ps-Latn", "sd-Latn", "ug-Latn", "ckb-Latn",
      // Hebrew script
      "he-Latn", "yi-Latn",
      // Thaana
      "dv-Latn",
      // Cyrillic
      "ru-Latn", "uk-Latn", "bg-Latn", "sr-Latn",
      // Greek
      "el-Latn",
      // Devanagari
      "hi-Latn", "mr-Latn", "ne-Latn",
      // Other Indic scripts
      "bn-Latn", "pa-Latn", "ta-Latn", "te-Latn", "gu-Latn", "kn-Latn", "ml-Latn", "si-Latn",
      // CJK + Thai
      "zh-Latn", "ja-Latn", "ko-Latn", "th-Latn",
      // Ethiopic
      "am-Latn", "ti-Latn",
    ];
    for (const code of expected) expect(isKnownLang(code), code).toBe(true);
    expect(ROMANIZED.map((l) => l.code).sort()).toEqual([...expected].sort());
  });

  it("names every romanized entry so the translate prompt asks for Latin script", () => {
    // The prompt is "Translate … into ${name}" — the name alone must instruct
    // romanization, or the model translates into the native script.
    for (const l of ROMANIZED) {
      expect(l.name, l.code).toMatch(/romaniz|latin/i);
    }
  });

  it("renders every romanized edition LTR, even for an RTL base language", () => {
    expect(isRtl("ur-Latn")).toBe(false);
    expect(langDir("ar-Latn")).toBe("ltr");
    for (const l of ROMANIZED) {
      expect(l.rtl ?? false, l.code).toBe(false);
      expect(isRtl(l.code), l.code).toBe(false);
    }
    // The native-script bases keep their direction.
    expect(isRtl("ur")).toBe(true);
    expect(isRtl("ar")).toBe(true);
  });

  it("does not serve the Devanagari webfont to a romanized edition", () => {
    for (const code of ["hi-Latn", "mr-Latn", "ne-Latn"]) {
      expect(isDevanagari(code), code).toBe(false);
    }
    // The native-script bases still get it.
    expect(isDevanagari("hi")).toBe(true);
    expect(isDevanagari("ne")).toBe(true);
  });

  it("resolves langInfo to the listed entry, not the bare-code fallback", () => {
    const info = langInfo("hi-Latn");
    expect(info.name).not.toBe("hi-Latn");
    expect(info.native).not.toBe("hi-Latn");
  });
});

// ---- Edition presentation (the 2026-09-08 architecture walk) -------------------
//
// `langInfo` was shallow: fifteen call sites turned it into one of exactly three
// shapes by hand. These pin the three, and pin the two things the hand-written
// copies disagreed about.

test("editionChip is the one projection the Edition-facing surfaces wanted", () => {
  expect(editionChip("es")).toEqual({ lang: "es", name: "Spanish", native: "Español", rtl: false });
  expect(editionChip("ur")).toEqual({ lang: "ur", name: "Urdu", native: "اردو", rtl: true });
  // A code outside the picker still resolves, via langInfo's fallback.
  expect(editionChip("xx")).toEqual({ lang: "xx", name: "xx", native: "xx", rtl: false });
});

test("the source Edition is labelled English, and its rtl is false rather than absent", () => {
  // Three sites wrote this override out. It is a no-op today, because the
  // registry carries `en` as English/English, and it is kept so that changing
  // SOURCE_LANG to an unlisted code cannot start labelling the source Edition
  // with its bare code.
  expect(editionChip(SOURCE_LANG)).toEqual({ lang: "en", name: "English", native: "English", rtl: false });
  expect(editionLabel(SOURCE_LANG)).toBe("English");
  expect(editionLabel("hi")).toBe("Hindi");
});

test("nonSourceEditionName badges a translation and leaves the source unbadged", () => {
  // Three client components wrote this out and all three compared the literal
  // "en" rather than SOURCE_LANG. The literal is what this deletes.
  expect(nonSourceEditionName(SOURCE_LANG)).toBeUndefined();
  expect(nonSourceEditionName("hi")).toBe("हिन्दी");
});

test("langDir is the only spelling of a language's direction", () => {
  // Three server sites open-coded `langInfo(x).rtl ? "rtl" : "ltr"` while this
  // function already existed and was called from the client.
  expect(langDir("en")).toBe("ltr");
  expect(langDir("ur")).toBe("rtl");
  expect(langDir("ur-PK")).toBe("rtl");
  expect(langDir("xx")).toBe("ltr");
});

test("no caller re-derives an Edition chip, a label or a direction by hand", () => {
  // The boundary. Each of these patterns had three to five copies before
  // 2026-09-08; a new one means the projection has started spreading again.
  const files = {
    ...(import.meta.glob("./**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>),
    ...(import.meta.glob("../src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<
      string,
      string
    >),
  };
  const src = Object.entries(files).filter(([p]) => !p.includes(".test.") && p !== "./languages.ts");

  const patterns: [string, RegExp][] = [
    ["the source-language English override", /SOURCE_LANG \? "English"/],
    ['a literal "en" comparison for the source Edition', /lang !== "en" \?/],
    ["an open-coded text direction", /\.rtl \? \("?rtl"?/],
  ];
  for (const [what, re] of patterns) {
    expect(src.filter(([, s]) => re.test(s)).map(([p]) => p), what).toEqual([]);
  }
});
