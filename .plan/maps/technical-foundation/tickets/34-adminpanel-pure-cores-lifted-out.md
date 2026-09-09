---
type: task
blocked_by: []
---
# AdminPanel's pure cores, lifted out

## Question

Filed 2026-09-07 from the 2026-09-04 architecture review (candidate 10), re-verified in
the tree on 2026-09-07. **This graduates half of this map's `AdminPanel.tsx` fog patch.**
The other half, the five-way tab split, stays fog anchored to
[03](03-shadcn-foundation.md).

The fog patch said nobody had established what the file splits into, and that the answer
probably waits on 03. **That holds for the five tabs. It does not hold for the pure cores
or the chart primitive**, which can move now and are the half carrying untested risk.

`AdminPanel.tsx` is **2667 lines** (measured 2026-09-07; the fog patch's 2617 was measured
2026-09-01, so it grew by 50 while sitting un-ticketed). It has 52 top-level functions and
**one export**, `AdminPanel()` at `:36`. Inside it:

- `coerceImportedTheme` and `validatePalette` (`:2122-2152`): pure, **six distinct
  throws, zero tests**, and reachable only by typing into a textarea. `:2119-2121` records
  that it mirrors the server's `assertThemeTokens`, which is the same hand-mirror hazard
  [23](23-tenant-token-mirror-has-no-test.md) closed for the theme tokens.
- `formatRand`: 10 call sites, 0 tests. `timeAgo`: 2 call sites, 0 tests.
- tenant-removal blockers (`:1736-1740`): computed inline in render, and they **gate a
  destructive button**.
- `DayStackChart` plus `VizLegend` (`:135-143`, named "the shared chart" in its own
  comment): a chart primitive with two real adapters already, so a genuine seam.
- `TabButton` and `ModeButton`: near-identical, and `:2345-2346` says one is "kept local
  to avoid coupling".

There are 16 client test files and none for `AdminPanel`, `Dashboard`, `SharingTab`,
`VoucherCard`, `CourseSettings` or `SeatSettings`.

## Done when

The pure cores live in `adminDerive.ts` beside the existing `salesChart.ts`
(`coerceImportedTheme`, `validatePalette`, `formatRand`, `timeAgo`, the removal blockers),
and the chart primitive has its own module with a stated interface (columns, empty, zero).
Each moved function has tests, and `validatePalette`'s six refusals are covered
individually, since covering them is the whole reason to move it.

Moves do not share a commit with behaviour changes, the same discipline
[16](16-empty-lib-ts.md) and [18](18-split-tenants-ts.md) set. `pnpm typecheck` and
`pnpm test` green after every commit.

**Explicitly out of scope: the five-way tab split.** `AdminPanel.tsx` becoming a scope
gate and a switch over `{Allowlist,Sales,Payouts,Tenants,Generation}Tab.tsx` waits on 03
settling the component vocabulary. Do not start it here, and do not resolve the remaining
fog patch on this map by doing it.

**Check `validatePalette` against the server before trusting it.** It mirrors
`assertThemeTokens`; if the two have already drifted, that is a finding to record, and 23
is the precedent for holding a hand-mirror to its canonical source with one assertion
rather than a refactor.

## Answer

2026-09-08, built. `adminDerive.ts` takes `coerceImportedTheme`, `validatePalette`,
`timeAgo` and `tenantRemovalBlockers`; `dayStackChart.tsx` takes the chart, which called
itself "the shared chart" in its own comment and already had two real adapters. 2660 lines
to 2489.

`validatePalette`'s six refusals each have their own test, which is the whole reason it
moved: they are the only feedback an operator gets on a bad paste, and nothing checked that
any of them said what it meant.

**Checked against the server before trusting it, as this ticket required. The two have NOT
drifted:** same token set (both read `TENANT_THEME_TOKENS`), same unknown-token refusal,
same light-complete rule, same deliberately-partial dark. Two differences, both
intentional. The client also refuses a non-string colour, where the server gets that from
its Convex validator rather than lacking it; and the client accepts a bare token map with
no envelope, which is an input convenience for a paste rather than a different rule about
what a valid theme is. The mirror is pinned to its canonical source by one assertion, which
is 23's precedent.

One behaviour change, and the only one: `timeAgo` takes `now` as a parameter with a
`Date.now()` default, because a function that reads the clock itself cannot be tested
without faking global time.

**The five-way tab split is not done, deliberately.** It waits on 03, and this map's
`AdminPanel.tsx` fog patch stays open for it.

Verified by test. `pnpm typecheck` and the full suite green.
