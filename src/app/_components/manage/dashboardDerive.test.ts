import { expect, test } from "vitest";
import { barPercent, priceSummary } from "./dashboardDerive";

const price = (lang: string, amount: number, currency = "ZAR") => ({ lang, amount, currency });

test("no listing at all is a free course", () => {
  expect(priceSummary([])).toEqual({ kind: "free" });
});

test("one figure across every priced Edition reads as that one price", () => {
  expect(priceSummary([price("en", 9900), price("es", 9900)])).toEqual({
    kind: "one",
    amount: 9900,
    currency: "ZAR",
  });
});

test("Editions priced differently read as a range, lowest first", () => {
  expect(priceSummary([price("es", 15000), price("en", 9900)])).toEqual({
    kind: "range",
    min: 9900,
    max: 15000,
    currency: "ZAR",
  });
});

test("a bar is a percentage of the panel's own largest bar, never of the total", () => {
  // The tallest bar fills the track; the rest are read against it.
  expect(barPercent(8, 8)).toBe(100);
  expect(barPercent(2, 8)).toBe(25);
  expect(barPercent(0, 8)).toBe(0);
  // An all-zero panel must not divide by zero.
  expect(barPercent(0, 0)).toBe(0);
});
