# 07 — Prod PayFast go-live

Status: done — marketplace LIVE on real money (2026-07-18)

## Parent

[PRD: Auth-first checkout + open sign-up](../PRD.md)

## What to do

Take the merged marketplace live on real money — everything after PR #3. The code is
done; this is operations. **No refunds on this rail** (`revokeEntitlement` only
removes access), so the smoke test stays cheap.

Already in place (2026-07-13 … 2026-07-16):

- Prod env (`capable-barracuda-769`): `PAYFAST_MERCHANT_ID=29853249`,
  `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PLATFORM_FEE_BPS=5000`,
  `SITE_URL=https://my-course.app` (operator-set; verify below).
- Sandbox journey passed end-to-end on the preview (own sandbox merchant `10051521`).
- PR #3 merged to main (`bb237bb`, 2026-07-16) — marketplace live on prod, selling
  auto-disabled until the PayFast env vars are complete (`payfastConfigured()`).
- Compliance pages live: /terms, /privacy, /refunds (privacy de-stacked in `3e7e66a`).
- **PayFast live account VERIFIED (FICA cleared) — 2026-07-18.** The account can now
  receive live payments; the remaining steps below are ours to run.

## Checklist

- [x] **Reply to PayFast's compliance email** — sent (policy URLs + accreditation
      clarification; account verified thereafter).
- [x] **PayFast live mode ON** — prod `PAYFAST_MODE=live` confirmed (2026-07-18).
- [x] **FICA verification clears** — DONE 2026-07-18: PayFast account verified/live.
- [x] **Passphrase match** — prod `PAYFAST_PASSPHRASE` matches the dashboard.
- [x] **Grant can-sell** — done.
- [x] **Payout details** — Seller bank details saved (status Ready).
- [x] **Price an Edition** — done.
- [x] **Real smoke purchase** — completed end-to-end on my-course.app (tested
      2026-07-17): checkout → PayFast → reactive unlock, verified working.

Remaining (operator discretion, not blocking):

- [ ] **Dev cleanup** — dev `SITE_URL` still points at the (now stale) branch
      preview alias; set it to `http://localhost:3000` for future local testing.

## Blocked by

- ~~PR #3 merged~~ done — `bb237bb`, 2026-07-16.
- ~~FICA verification~~ done — account verified/live 2026-07-18. Nothing blocks the
  go-live steps now.
