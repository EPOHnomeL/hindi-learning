// Pure derivations for the manage route's Dashboard tab (ui-overhaul 23), split
// out of the component so the arithmetic is testable without a render, the way
// salesChart.ts / priceDerive.ts already are.

export type EditionPrice = { lang: string; amount: number; currency: string };

export type PriceSummary =
  | { kind: "free" }
  | { kind: "one"; amount: number; currency: string }
  | { kind: "range"; min: number; max: number; currency: string };

// What the Price stat says for a whole course, given only its PRICED Editions
// (`courseStats.prices`, where an absent lang is free). Three states, because a
// course prices per Edition and the tile is one line: no listing is free, one
// figure everywhere is that figure, anything else is a range.
//
// The currency is taken from the rows rather than reconciled across them: the
// selling rail is ZAR only by decision (the platform's settlement currency, see
// `listings` in convex/schema.ts), so every row on one course already shares it.
// The regional `usdAmount` / `eurAmount` points are per buyer, not per course,
// and are deliberately not summarised here.
export function priceSummary(prices: readonly EditionPrice[]): PriceSummary {
  if (prices.length === 0) return { kind: "free" };
  const amounts = prices.map((p) => p.amount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const currency = prices[0]!.currency;
  return min === max ? { kind: "one", amount: min, currency } : { kind: "range", min, max, currency };
}

// How much of its track one bar fills. Measured against the panel's own LARGEST
// bar, not against the total: both panels compare counts to each other ("which
// language, which rung"), and normalising by the total would flatten every bar
// on a course whose readers spread evenly.
export function barPercent(count: number, max: number): number {
  if (max <= 0 || count <= 0) return 0;
  return (count / max) * 100;
}
