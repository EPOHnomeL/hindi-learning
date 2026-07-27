# admin-sales/01: Sales report query (`sales.report`)

**Status:** open

Admin-only Convex query aggregating the `ledger` into a sales report.

## Contract
`sales.report({ from?: number, to?: number })` → array of courses:
```ts
{
  topicId: Id<"topics">,
  courseTitle: string,     // topic.title (source)
  gross: number,           // sum of ledger.gross (cents) in period
  count: number,           // number of sales in period
  editions: Array<{
    lang: string,
    title: string,         // translatedTitle(topicId, lang)
    gross: number,
    count: number,
  }>,
}
```

## Rules
- Admin-only (`isCallerAdmin`, throw `"forbidden"` otherwise) — mirror `ledger.ts`.
- Counts **all** ledger rows (owed + paid).
- `from`/`to` are ms; include rows with `from <= _creationTime < to`. Omitted
  bound = open on that side ("All time" = both omitted).
- Courses sorted by gross desc; editions within a course sorted by gross desc.
- Topics with no sales in the period do not appear.
- Bounded `.collect()` + JS filter (no time index exists). ponytail-flagged.

## Tests (`convex/sales.test.ts`)
- Non-admin rejected.
- Groups by course, sub-groups by edition, sums gross + counts.
- `owed` and `paid` rows both counted.
- Time filter includes/excludes by `_creationTime`; all-time returns everything.
- Sorted by gross desc.
