/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { LOCALES } from "../src/i18n/config";

// The build-time key-parity gate (app-language-i18n ticket 05). English is the
// source of truth for the key set; every other `messages/<code>.json` must carry
// EXACTLY en.json's leaf keys — no missing (untranslated) key, no extra (stale)
// key. This runs in the normal `pnpm test` / CI gate, so a catalogue that drifts
// out of sync with English fails the build. Pure static check — no runtime
// sourceHash, no Convex rail (both rejected by ticket 04).
const files = import.meta.glob("./*.json", { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>;

// Flatten a nested message object to its set of dotted leaf key-paths. A leaf is
// any non-object value (an ICU/rich-text string counts as one leaf, regardless of
// the placeholders or tags inside it).
function leafKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === "object"
      ? leafKeys(v as Record<string, unknown>, path)
      : [path];
  });
}

const enKeys = [...new Set(leafKeys(files["./en.json"]!.default))].sort();

describe("message catalogue parity", () => {
  it("every offered locale has a messages/<code>.json file", () => {
    for (const code of LOCALES) {
      expect(files[`./${code}.json`], `missing messages/${code}.json`).toBeDefined();
    }
  });

  for (const code of LOCALES) {
    if (code === "en") continue;
    it(`${code}.json carries exactly en.json's leaf keys`, () => {
      const file = files[`./${code}.json`];
      expect(file, `missing messages/${code}.json`).toBeDefined();
      const keys = new Set(leafKeys(file!.default));
      const missing = enKeys.filter((k) => !keys.has(k));
      const extra = [...keys].filter((k) => !enKeys.includes(k)).sort();
      // Report both lists so a drift names exactly which keys to add/remove.
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });
  }
});
