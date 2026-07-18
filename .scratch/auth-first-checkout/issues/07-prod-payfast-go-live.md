# 07 — Prod PayFast go-live

Status: open

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

## Checklist

- [ ] **Reply to PayFast's compliance email** (Vuyisile) with the live policy URLs —
      draft ready:

      > Hi Vuyisile,
      >
      > Thank you for the guidance. The requested policies are now live on our website:
      >
      > - Terms & Conditions: https://my-course.app/terms
      > - Privacy Policy: https://my-course.app/privacy
      > - Refund & Cancellation Policy: https://my-course.app/refunds
      >
      > All three are linked from the site footer, and the terms and refund policy
      > are also shown at checkout before payment.
      >
      > Please let me know if anything further is needed for compliance.
      >
      > Regards, Jonathan Vorster — My Course, https://my-course.app

- [ ] **Turn PayFast live mode ON** — verify/set on prod:
      `npx convex env get --prod PAYFAST_MODE` must be exactly `live`
      (`npx convex env set --prod PAYFAST_MODE live` if not). Anything else —
      absent, typo'd, "Live" — silently means SANDBOX by design, and a real buyer
      would be sent to the sandbox gateway. This is the go-live switch.
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

- ~~PR #3 merged~~ done — `bb237bb`, 2026-07-16.
- FICA verification (blocks the smoke purchase and real selling).
