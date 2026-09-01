import { expect, test } from "vitest";
import { barPercent, priceSummary, reviewByEdition } from "./dashboardDerive";

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

// ---- Editions and their editors (ui-overhaul 26) --------------------------

const ed = (lang: string, published = false) => ({ lang, published });
const row = (lang: string, person: string, completed: number, pending = false) => ({
  lang,
  person,
  pending,
  completed,
});

test("every Edition gets a row, including the ones with no editor at all", () => {
  const out = reviewByEdition([ed("en"), ed("es"), ed("fr")], [row("es", "a@test.invalid", 3)], []);
  expect(out.map((r) => r.lang)).toEqual(["en", "es", "fr"]);
  expect(out.find((r) => r.lang === "fr")!.editors).toEqual([]);
});

test("an Edition nobody has worked through is unreviewed only once it is live", () => {
  // Not published, not priced: it is not in front of anyone, so there is
  // nothing to warn about yet.
  expect(reviewByEdition([ed("es")], [], [])[0]).toMatchObject({ live: false, unreviewed: false });
  // Published with no editor at all: the machine-translation backlog case.
  expect(reviewByEdition([ed("es", true)], [], [])[0]).toMatchObject({ live: true, unreviewed: true });
  // Priced counts as live even when unpublished.
  expect(reviewByEdition([ed("es")], [], ["es"])[0]).toMatchObject({ live: true, unreviewed: true });
});

test("an editor who has marked nothing complete does not make an Edition reviewed", () => {
  const appointed = reviewByEdition([ed("es", true)], [row("es", "a@test.invalid", 0)], [])[0]!;
  expect(appointed).toMatchObject({ live: true, unreviewed: true });
  const working = reviewByEdition([ed("es", true)], [row("es", "a@test.invalid", 1)], [])[0]!;
  expect(working).toMatchObject({ live: true, unreviewed: false });
});

test("an Edition's editors are its own, and a pending invite rides along", () => {
  const out = reviewByEdition(
    [ed("es"), ed("fr")],
    [row("es", "a@test.invalid", 4), row("fr", "b@test.invalid", 0, true), row("es", "b@test.invalid", 0, true)],
    [],
  );
  expect(out.find((r) => r.lang === "es")!.editors.map((e) => e.person)).toEqual([
    "a@test.invalid",
    "b@test.invalid",
  ]);
  expect(out.find((r) => r.lang === "fr")!.editors).toEqual([row("fr", "b@test.invalid", 0, true)]);
});
