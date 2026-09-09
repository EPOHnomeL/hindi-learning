// @vitest-environment node
import { expect, test } from "vitest";
import { formatMoney, fromMajor, toMajor } from "./money";
import { priceLabel } from "./poster";

// One money formatter (the 2026-09-08 architecture walk). Four existed, and one
// R100 Edition printed three different ways: `R100` on its poster, `R 100,00` in
// the admin cash log, and whatever the visitor's locale made of the paygate's
// `style: "currency"`.
//
// The operator chose two decimal places everywhere on 2026-09-08, over keeping
// two named styles and over the poster's compact spelling.

test("always two decimal places, on a round amount and a fractional one", () => {
  // The decision, pinned. `R100` was the poster's old output for the first of
  // these, and this is what changed.
  expect(formatMoney(10000, "ZAR", { locale: "en-ZA" })).toBe("R 100,00");
  expect(formatMoney(9950, "ZAR", { locale: "en-ZA" })).toBe("R 99,50");
  expect(formatMoney(5, "ZAR", { locale: "en-ZA" })).toBe("R 0,05");
});

test("the narrow symbol, so ZAR is R rather than the spelled-out code", () => {
  // The paygate used the default `currencyDisplay`, which spells the code out in
  // locales that do not know the symbol, so the same price read `ZAR 1 200,00`
  // for one visitor and `R 1 200,00` for another.
  // `Intl` separates a narrow symbol from the figure with a NON-BREAKING space
  // in some locales, so the escape is deliberate: a test written with a plain
  // space here fails on a difference nobody can see in the diff.
  expect(formatMoney(120000, "ZAR", { locale: "en-US" })).toBe("R\u00a01,200.00");
  expect(formatMoney(120000, "USD", { locale: "en-US" })).toBe("$1,200.00");
});

test("a currency Intl rejects falls back rather than throwing on a price already shown", () => {
  expect(formatMoney(10000, "notacurrency")).toBe("100.00 NOTACURRENCY");
});

test("the poster now prints exactly what every other surface prints", () => {
  // The whole point of the collapse: the poster's price and the cash log's price
  // are the same string for the same amount.
  expect(priceLabel(10000, "ZAR", "en-ZA")).toBe(formatMoney(10000, "ZAR", { locale: "en-ZA" }));
  expect(priceLabel(9950, "ZAR", "en-ZA")).toBe(formatMoney(9950, "ZAR", { locale: "en-ZA" }));
});

test("toMajor and fromMajor round-trip a typed price without losing a cent", () => {
  expect(toMajor(19999)).toBe(199.99);
  // `19.99 * 100` is 1998.9999999999998 in binary floating point, which would
  // price the Edition a cent light. This is why `fromMajor` rounds.
  expect(fromMajor("19.99")).toBe(1999);
  expect(fromMajor(19.99)).toBe(1999);
  expect(fromMajor("100")).toBe(10000);
  expect(fromMajor(toMajor(123456))).toBe(123456);
});
