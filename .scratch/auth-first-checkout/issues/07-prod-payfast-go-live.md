# 07 — Prod PayFast go-live

Status: open

## Parent

[PRD: Auth-first checkout + open sign-up](../PRD.md)

## What to do

Take the merged marketplace live on real money — everything after PR #3. The code is
done; this is operations. **No refunds on this rail** (`revokeEntitlement` only
removes access), so the smoke test stays cheap.

Already in place (2026-07-13):

- Prod env (`capable-barracuda-769`): `PAYFAST_MERCHANT_ID=29853249`,
  `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_MODE=live`,
  `PLATFORM_FEE_BPS=5000`, `SITE_URL=https://my-course.app`.
- Sandbox journey passed end-to-end on the preview (own sandbox merchant `10051521`).

## Checklist

- [ ] **FICA verification clears** — the payfast.io dashboard's "Account pending
      verification" banner disappears + PayFast emails. Confirm all three documents
      are uploaded (SA ID, proof of address <3mo, bank letter) or it never resolves.
      Until then the account can't properly receive live payments.
- [ ] **Passphrase match** — the passphrase in the PayFast dashboard
      (Settings → Integration) equals prod `PAYFAST_PASSPHRASE` character for
      character. A mismatch surfaces later as "signature does not match" at checkout.
- [ ] **Grant can-sell** — Admin (`jvorster63@gmail.com`) → `/admin` → Sellers →
      grant the seller account.
- [ ] **Payout details** — the Seller saves SA bank details in-app (status → Ready).
- [ ] **Price a cheap Edition** — a completed course, ZAR, PayFast minimum is R5.00.
      Keep it at the minimum for the smoke test.
- [ ] **One real smoke purchase** on my-course.app: incognito → share link → Buy →
      sign up → PayFast (real card/EFT) → return → confirming banner → reactive
      unlock. Then verify in prod Convex: one `checkoutIntents`, one `payfastEvents`,
      one `entitlements`, one `ledger` row (`status: "owed"`, sellerShare ==
      platformShare).
- [ ] **Watch the first live ITN** — prod Convex logs for `/payfast/notify` (a
      signature/postback rejection shows up there, not in the browser).
- [ ] **Re-price for real** once the smoke test passes.
- [ ] **Dev cleanup** — dev `SITE_URL` still points at the (now stale) branch
      preview alias; set it to `http://localhost:3000` for future local testing.

## Blocked by

- PR #3 merged (deploys the marketplace schema + functions to prod).
- FICA verification (blocks only the smoke purchase, not the merge).
