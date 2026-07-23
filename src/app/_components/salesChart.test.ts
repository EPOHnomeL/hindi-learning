import { expect, test } from "vitest";
import { colorVar, rankLanguages } from "./salesChart";

const course = (...editions: { lang: string; count: number }[]) => ({ editions });

test("languages rank by total sales across courses, desc, alpha tie-break", () => {
  const report = [course({ lang: "en", count: 2 }, { lang: "es", count: 5 }), course({ lang: "en", count: 4 })];
  // en total 6, es total 5.
  expect(rankLanguages(report)).toEqual(["en", "es"]);
  // Ties break alphabetically so colours never flip run-to-run.
  expect(rankLanguages([course({ lang: "ur", count: 1 }, { lang: "hi", count: 1 })])).toEqual(["hi", "ur"]);
});

test("colour follows the language's rank, folding the 9th+ into 'other'", () => {
  const ranked = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  expect(colorVar("a", ranked)).toBe("var(--viz-1)");
  expect(colorVar("h", ranked)).toBe("var(--viz-8)");
  expect(colorVar("i", ranked)).toBe("var(--viz-other)"); // 9th
  expect(colorVar("zzz", ranked)).toBe("var(--viz-other)"); // unknown
});
