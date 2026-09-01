---
type: task
blocked_by: [10]
---
# Build: the voucher and EFT switches

## Question

The three bulk-access rails are the "then vouchers, then 2 types" half of the operator's ask, and
none of them has a tenant grain today. Build the switches [01](01-the-tenant-switch-inventory.md)
named, with the off-semantics [02](02-what-off-does-to-live-data.md) decided, under whatever
parent-child relationship to `selling` 01 landed on.

The two voucher rails are named differently in the product and in the code, deliberately, and
mixing them up is the standing trap here. From `docs/agents/project-context.md`:

| Product name | Code |
| --- | --- |
| **Organisation Voucher** | `accessCodes` table, `seats` table, `convex/accessCodes.ts`, `mintAccessCode`, `/join` |
| **Bulk Vouchers** | `voucherBatches` and `vouchers` tables, `convex/vouchers.ts`, `mintBatch`, `/redeem` |

Three POPIA-shaped constraints on the Organisation Voucher rail survive untouched by any flag work,
so do not disturb them while passing through: a Seat's handle is **self-chosen** and `/join` says so
in those words, the Entitlement a Seat mints carries **no provenance** (pinned by
`accessCodes.test.ts`), and a Seat earns **no Certificate** (enforced in `certificates.ts`).

The mint sites are the create path and are the obvious gate points. The redeem and join sites are
where 02's create-path-versus-grant reading actually bites, so implement exactly what 02 decided
there rather than reasoning afresh.

## Done when

- [ ] Bulk Vouchers: `vouchers.mintBatch` is gated, and `vouchers.redeem` behaves exactly as 02
      decided for an already-minted unredeemed code, with a test for that case.
- [ ] Organisation Vouchers: `accessCodes.mintAccessCode` is gated, and `claimSeat`,
      `raiseCapacity` and `stopCode` each behave as 02 decided for a live capped code, tested.
- [ ] EFT: `eft.startEftPurchase` is gated, and a pending intent awaiting operator confirmation
      behaves as 02 decided.
- [ ] The parent relationship to `selling` from 01 holds: switching selling off produces whatever 01
      said it should for these three, with a test.
- [ ] The mint forms in `manage/VoucherCard.tsx`, and the `/redeem` and `/join` routes, hide behind
      the [08](08-build-the-client-flag-seam.md) seam per 02's off-semantics.
- [ ] The three POPIA constraints are verified untouched: self-chosen handle wording, no provenance
      on the Entitlement, no Certificate for a Seat. Name each in the Answer.
- [ ] `pnpm typecheck` and the Convex suite are green.
