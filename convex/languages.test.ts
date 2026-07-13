import { describe, expect, it } from "vitest";
import { LANGUAGES, isDevanagari, isKnownLang, isRtl, langDir, langInfo } from "./languages";

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
