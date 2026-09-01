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

export type EditorRow = { lang: string; person: string; pending: boolean; completed: number };

export type EditionReview = {
  lang: string;
  editors: EditorRow[];
  // The owner has put this Edition in front of readers: listed in the catalogue
  // or priced. Both are OWNER acts, which is the whole problem below.
  live: boolean;
  // Live, and nobody has worked through it: no editor on it has a single
  // completion mark. THE QUALIFIER, ruled by the operator on 2026-09-01,
  // answering translator-status-report ticket 08 ("does Finished lie?").
  //
  // The derived ladder read a published or priced Edition as Finished, and both
  // of those are things the OWNER does, so on a course whose owner publishes
  // eagerly every language read Finished, including the five machine-translated
  // Editions of `prophetic-school` that no human has ever touched. Rather than
  // render that literally (wrong on day one) or demand a human before calling
  // anything finished (which would mark live Editions unfinished), the ruling is
  // to QUALIFY it: still live, but flagged unreviewed, so the machine Editions
  // read as a visible backlog instead of a false finish line.
  unreviewed: boolean;
};

// One row per Edition for the tab's foot, its editors attached. EVERY Edition
// gets a row, including the ones with no editor: a language nobody has been
// appointed to is the most useful cell on this table, and a list of only
// appointed editors cannot show it (ui-overhaul 26, decision 3).
export function reviewByEdition(
  editions: readonly { lang: string; published: boolean }[],
  editorRows: readonly EditorRow[],
  pricedLangs: readonly string[],
): EditionReview[] {
  const priced = new Set(pricedLangs);
  return editions.map((e) => {
    const editors = editorRows.filter((r) => r.lang === e.lang);
    const live = e.published || priced.has(e.lang);
    // `every` on an empty list is true, which is the case we want: live with no
    // editor at all is the machine-translation backlog this flag exists for.
    return { lang: e.lang, editors, live, unreviewed: live && editors.every((r) => r.completed === 0) };
  });
}

// How much of its track one bar fills. Measured against the panel's own LARGEST
// bar, not against the total: both panels compare counts to each other ("which
// language, which rung"), and normalising by the total would flatten every bar
// on a course whose readers spread evenly.
export function barPercent(count: number, max: number): number {
  if (max <= 0 || count <= 0) return 0;
  return (count / max) * 100;
}
