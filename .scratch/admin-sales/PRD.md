# Admin sales report + payouts as its own tab

**Status:** in progress
**Date:** 2026-07-23

## Problem

As a sys admin I want to see which **courses** and which **editions** have sold
how much over a chosen time period. Today the only money surface in the admin
dashboard is `PayoutsManager` (what's owed per seller, operational not
reporting), and it's buried at the bottom of the **Allowlist** tab.

## Scope

### 1. Sales report (new tab)
- New top-level **Sales** tab in `SysAdminDashboard`.
- **Breakdown:** courses as top-level rows (course title, total gross, total
  sale count); each course expands to its **editions** — one row per `(topic,
  lang)` with the edition title, gross and count.
- **Metrics per row:** gross revenue (Rand) + number of sales. (`gross` = what
  the buyer paid, in cents, ZAR.)
- **Scope of sales:** ALL ledger rows — both `owed` and already `paid` — i.e.
  true sales history, not just what's currently unpaid.
- **Time period:** preset ranges (Last 7 days, Last 30 days, This month, All
  time) + a custom start/end date range. Filters on the sale timestamp
  (`ledger._creationTime`).
- Empty state when no sales fall in the period.

### 2. Payouts → own tab
- Move `PayoutsManager` out of the Allowlist tab into its own top-level
  **Payouts** tab. No behaviour change to payouts themselves.

## Backend

- New Admin-only query `sales.report({ from?, to? })` (ms timestamps, both
  optional; "All time" omits both). Groups `ledger` by `topicId`, then by
  `lang` within each; joins `topics` for the course title and `translatedTitle`
  for the edition label. Returns courses sorted by gross desc, editions sorted
  by gross desc.
- **Money:** cents, integer, ZAR (no currency column on `ledger`).

## Non-goals / notes

- No refunds metric (revoke doesn't touch the ledger — out of scope).
- No platform/seller-share split in the report (gross + count only).
- **ponytail:** `ledger` has no time-range index (only `by_status`). The report
  does a bounded full `.collect()` and filters in JS. Fine at current scale;
  if the ledger grows large, add a time index. Tracked as deferred.

## Tabs after this change
Allowlist · Sales · Payouts · Tenants · Generation (Allowlist stays default).
