---
type: task
blocked_by: []
---
# One Ledger writer for the money event

## Question

Filed 2026-09-07 from the 2026-09-04 architecture review (candidate 5), re-verified in
the tree on 2026-09-07.

**Five rails each hand-assemble a ledger row plus its `splitNet` call:**
`market.ts:317`, `eft.ts:403`, `donations.ts:190`, `vouchers.ts:118`,
`accessCodes.ts:475`. The payout arithmetic is therefore reachable from five places, and
the copies have already diverged:

- `market.ts:299-301` and `donations.ts:172-174` each run their own non-negative-integer
  cents loop. **`eft.ts:401-416` has no cents check at all**, so the EFT rail is the copy
  that lost it.
- `market.ts:265-273` and `donations.ts:176-181` each implement idempotency-by-payment-id
  separately.
- `market.ts:431-439` and `eft.ts:183-191` are the same four-check
  purchasable-right-now sale gate written twice; `eft.ts:187` says so in a comment.
- `eft.ts:59-61` carries a `ponytail:` note anticipating exactly this. The third caller
  has since arrived.

## Done when

One module owns the money event: a `recordLedger(kind, amounts, payee, ref)` that does the
split, the cents validation and the insert; a `oncePerPayment(pfPaymentId)`; and a
`purchasableEdition(slug, lang)` that both purchase rails call. `payfast.splitNet` becomes
internal to it, so the payout arithmetic stops being reachable from five files. The EFT
rail regains cents validation, with a test that fails without it.

Behaviour otherwise unchanged. `pnpm typecheck` and `pnpm test` green. Use the `tdd`
skill: this map's Notes name it for anything touching the money rail.

**No ADR conflict; this makes two ADRs structural rather than remembered.** ADR 0026
(manual EFT rail) and ADR 0027 (per-tenant donation rail) both *require* the shared shape,
same table, same owed status, same split. Right now that requirement is held only by five
hand-written copies happening to agree.

**`docs/ponytail-debt.md` has an entry to close here.** The `eft.ts:59-61` marker was
accepted, not deferred, on the grounds that a second caller was not yet a pattern. Update
the ledger in the same session rather than leaving it asserting a world this ticket ends.

## Answer

2026-09-08, built. `convex/moneyEvent.ts` owns the money event: `recordMoneyEvent` does
the split, the cents validation and the insert; `oncePerPayment` is the ITN idempotency
both PayFast rails needed; `purchasableEdition` is the four-check sale gate that `market.ts`
and `eft.ts` each wrote out.  A rail still decides its own kind, status, fee rate, payee and
provenance, because those genuinely differ.

`splitNet` moved out of `payfast.ts`, which is the gateway wire format and never was the
right home: the donation, Voucher Batch and Access Code rails all split a net and none of
them touches a gateway. It is exported for its own test only, and a boundary assertion
fails if a rail imports it again.

The EFT rail's regained cents check has a test that was **proved to fail without it**.

**One claim in this ticket is wrong.** It said the `eft.ts:59` `ponytail:` marker
anticipated this writer and asked for the ledger entry to be closed. That marker is about
bank-details validation shared with `sellers.savePayoutDetails`, and its trigger (a third
bank-details form) has not fired. `docs/ponytail-debt.md` records the correction, and its
drifted line numbers were re-measured while there.

Verified by test. `pnpm typecheck` and the full suite green.
