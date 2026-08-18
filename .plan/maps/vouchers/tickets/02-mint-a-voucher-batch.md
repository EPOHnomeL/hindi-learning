---
type: task
blocked_by: [01]
---
# Mint a Voucher Batch

## Question

Can a **Seller** turn a negotiated bulk deal into N usable codes in one act?

A Seller has agreed to sell an organisation 100 seats on one Edition of their own course for a
total they set themselves. They need the codes now - they are in the meeting - and the money will
arrive by bank transfer afterwards. So minting creates everything at once: the batch, its codes,
and its **unpaid** Ledger row. The codes are **live immediately**; the cash log is bookkeeping, not
a gate ([ADR 0029](../../../../docs/adr/0029-seller-minted-voucher-rail.md)).

Two new tables. A **batch** row holds the Edition (`topicId` plus `lang`), the minting Seller, the
seat count, the agreed total in cents, the buying organisation's name and billing contact as plain
strings, its `ledgerId`, and a voided marker. A **voucher** row holds its `batchId`, its `code`,
and an optional `redeemedAt` - and **no user id**, ever. Absent `redeemedAt` is the entire state
machine, and there is no redemption counter anywhere: counts are derived by counting rows.

The organisation is **two strings**, not an entity. Resist the pull towards a table.

Authorisation reuses what already exists rather than inventing a voucher-specific gate: a `sellers`
row must exist (the Admin's can-sell grant) **and** carry saved `payout` details - the platform must
never issue seats it cannot pay for. On top of that the caller must own the Topic, and the Edition
must be **published**. It need **not** be priced: the Seller states the total, so a listing price is
irrelevant to a batch.

## Done when

- `voucherBatches` and `vouchers` exist in `convex/schema.ts`, with the indexes the later tickets
  need: vouchers `by_code` (the redeem lookup) and `by_batch` (the count and the CSV), batches
  `by_seller` and one serving the sysadmin's unpaid queue. The `vouchers` table has no user field,
  and a comment says that is deliberate and points at the ADR.
- `convex/vouchers.ts` exists with `mintBatch`, which in one mutation creates the batch, its N
  vouchers, and exactly **one** Ledger row: `kind: "batch"`, `status: "unpaid"`, `fee: 0`, `gross`
  = the stated total, the standard 50/50 split, `sellerId` = the caller, `buyerEmail` = the
  organisation's billing contact.
- Codes are generated server-side in the form `MYC-7K4Q-2XR9` from a 32-character alphabet
  excluding `O`, `0`, `I` and `1`, so a code survives being read aloud or written on a card. A
  collision retries rather than throwing.
- `convex/vouchers.test.ts` asserts the happy path (N voucher rows, one ledger row, every field
  above) and every negative as a **server-side throw**: no `sellers` row; a `sellers` row with no
  payout details; not the Topic's owner; an unpublished Edition; a sysadmin attempting it. Follow
  `convex/eft.test.ts` for `convexTest`, identities and fixtures.
- No UI in this ticket, and nothing redeems yet. The batch is verifiable by test alone.
- The minted Ledger row does **not** appear in `owedPayouts` - the guard from 01, now exercised by
  a real writer.

## Answer

**Done 2026-08-18. Verified by reading the code and by a green test suite** (854 tests, 73 files,
`pnpm typecheck` and `pnpm build` clean) - not walked in a browser, which this ticket has no
surface for; the batch is verifiable by test alone, as planned.

`voucherBatches` and `vouchers` landed with the indexes the later tickets need, and
`convex/vouchers.ts` exists with `mintBatch` writing the batch, its N codes and exactly ONE Ledger
row in a single mutation: `kind: "batch"`, `status: "unpaid"`, `fee: 0`, `gross` = the stated
total, the 50/50 split through `splitNet`, `sellerId` = the caller, `buyerEmail` = the
organisation's billing contact. Ticket 01's guard needed no help from this ticket: there is a test
that a freshly minted batch leaves `owedPayouts` empty, and it passes because `unpaid` simply is
not `owed`.

**The unpaid-queue index is an absent field, not a second status.** The sysadmin's queue reads
`by_payment_ref` for `q.eq("paymentRef", undefined)` - the reference the sysadmin logs in ticket 04
is the only thing that leaves the queue. A `paid: boolean` on the batch was the obvious
alternative and was rejected: the payment state already lives on the Ledger row, and a second copy
of it on the batch is a thing that can disagree with the first.

**The code format is `MYC-XXXX-XXXX` with a fixed prefix.** The spec's example (`MYC-7K4Q-2XR9`)
has three groups but only two of them can carry entropy at that shape, so `MYC` is literal: it
makes a code recognisable as one when it turns up out of context in a group chat, and the 8 random
characters over the 32-character alphabet give ~1.1e12 codes. Collisions retry on insert, bounded
at five - five clashes in a row is a broken RNG, not bad luck, and looping on that would hang the
mutation.

Two small things the ticket did not name and the build wanted anyway: a **seat cap of 1000**,
because a batch is one Convex transaction and a mistyped seat count should be a refusal rather than
an unusable mutation; and a **non-blank organisation name and contact**, because the contact is the
Ledger row's `buyerEmail` and a blank one would put an anonymous money event in the payouts view.

The authorisation gates are the existing ones verbatim - a `sellers` row plus saved payout details,
via `sellerStatusOf` - with Topic ownership and a PUBLISHED Edition on top. Every negative is a
server-side throw with a test: no `sellers` row, a row with no payout details, another Seller's
course, an unpublished Edition, the sysadmin, and a Guest.
