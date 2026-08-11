# admin-sales/02: Sales tab + Payouts as its own tab (AdminPanel)

**Status:** shipped. Corrected 2026-08-11: this was still marked open while built.
`SalesManager`, `SalesDayChart` and a standalone Payouts tab are all live in
`src/app/_components/AdminPanel.tsx`, with chart helpers in `salesChart.ts` /
`dayChart.ts`. Read the code, not this file.

Frontend in `src/app/_components/AdminPanel.tsx`.

## Changes
- Extend `SysAdminDashboard` tab union to include `"sales"` and `"payouts"`.
- Tab order: Allowlist · Sales · Payouts · Tenants · Generation (Allowlist default).
- Remove `<PayoutsManager />` from `AllowlistManager`.
- `PayoutsManager` becomes its own tab body (page heading, `max-w-2xl` shell) —
  no behaviour change.
- New `SalesManager`:
  - Period selector: presets (Last 7 days, Last 30 days, This month, All time) +
    custom start/end `<input type="date">`. All time = no bounds.
  - Calls `api.sales.report` with `{ from, to }`.
  - Course rows (title, gross via `formatRand`, count); click to expand editions.
  - Loading skeletons + empty state, matching existing sections.

## Done when
- Payouts no longer under Allowlist; reachable via its own tab.
- Sales tab shows course→edition breakdown for the selected period.
- `pnpm typecheck` + `pnpm test` green.
