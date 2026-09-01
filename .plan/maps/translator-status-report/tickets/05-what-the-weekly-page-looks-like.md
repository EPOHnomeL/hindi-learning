---
type: prototype
blocked_by: []
---
# What the weekly page actually looks like

## Question

The report is one Claude Artifact, read on a Sunday morning, and print-friendly (the
teach skill's standing bar for a reference document: "beautiful documents which print
out well"). Nobody has seen it yet, and "a table and a graph" is not a design.

Make a rough standalone HTML page against **fixture data** and react to it. This is
cheap and it de-risks 06, which otherwise designs and builds in one pass.

Questions the prototype should settle:

- **The per-language table.** Fourteen rows, four rungs. What carries the eye: the
  rung, the language, or the person? Where do "no Edition yet" and "machine Edition,
  no human" sit without becoming a second status column (that two-axis shape was
  rejected in the charting grill)?
- **The most useful line on the page.** Probably not a status at all, but the *action*:
  "Zondi still has no email address", "Wikus has two languages and no account". Does
  that read as a column, a callout, or a short list above the table?
- **The chart.** `sellerShare` per language, stacked owed and paid, donations as their
  own bar. At launch-stage volume this may be almost empty; decide what an honest empty
  chart looks like rather than discovering it on a Sunday.
- **The stamp.** Every roster-sourced cell is only as fresh as the last import. The page
  needs an as-of date that is impossible to miss, or it will be trusted more than it
  deserves.
- **Print.** One page or several, and what breaks across a page boundary.

Load `dataviz` **before** writing any chart markup, and `artifact-design` before
publishing anything. Reuse the existing visual language where you can: `VIZ_SLOTS`,
`rankLanguages` and `colorVar` in
[`src/app/_components/salesChart.ts`](../../../src/app/_components/salesChart.ts), and
`niceMax` / `axisTicks` / `labelIndices` in
[`dayChart.ts`](../../../src/app/_components/dayChart.ts). The maths transfers; the
React component does not.

## Done when

- A standalone HTML file in `assets/` here, rendering realistic fixture data (invented
  names, since this map's assets are committed to a **public** repo).
- The user has reacted to it and the layout is agreed, including the empty-chart case.
- The Answer records what was chosen **and what was rejected**, so 06 does not
  re-open it.
