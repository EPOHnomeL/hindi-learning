// Pure model for the admin Sales-by-course chart (.scratch/admin-sales, dataviz
// skill). Bars are courses, segments are editions, measured in number of sales;
// segment colour follows the edition's LANGUAGE (a fixed categorical slot),
// consistently across every course — never the language's position within one
// course. The 9th+ language folds into a neutral "other" so the categorical
// palette is never cycled past its validated eight slots.

export const VIZ_SLOTS = 8;

type ChartEdition = { lang: string; count: number };
type ChartCourse = { editions: readonly ChartEdition[] };

// Languages ranked by total sales across all courses (desc), tie-broken
// alphabetically so the slot assignment is deterministic. Rank order is the
// colour-slot order: the most-sold language takes slot 1.
export function rankLanguages(report: readonly ChartCourse[]): string[] {
  const totals = new Map<string, number>();
  for (const c of report) {
    for (const e of c.editions) totals.set(e.lang, (totals.get(e.lang) ?? 0) + e.count);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([lang]) => lang);
}

// The CSS colour variable for a language, by its rank. Past the eight validated
// slots, everything is the neutral "other" fill.
export function colorVar(lang: string, ranked: readonly string[]): string {
  const i = ranked.indexOf(lang);
  return i >= 0 && i < VIZ_SLOTS ? `var(--viz-${i + 1})` : "var(--viz-other)";
}
