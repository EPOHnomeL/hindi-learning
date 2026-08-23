---
type: task
blocked_by: [01]
---
# Mint an Access Code

> `/wayfinder .plan/maps/shared-access-codes/tickets/02-mint-an-access-code.md`

## Question

A Seller needs one shared string to hand an organisation, carrying the two numbers the deal was
struck on: how many seats it is good for, and what each one costs.

This mirrors `mintBatch` in `convex/vouchers.ts` closely enough that it should be read first, with
two deliberate differences. **A batch writes its Ledger row at mint; an Access Code writes none.**
A batch's total is known when it is created, so the money event is the batch. An Access Code's
total is unknown until it stops, so there is nothing to write yet and `ledgerId` stays absent until
ticket 06. **A batch prices the whole deal as one lump; an Access Code prices a seat**, because
here the count is the thing that varies.

The code format follows the voucher one closely enough to read as a sibling, and differs enough
that nobody mistakes one rail's code for the other's.

## Done when

- `accessCodes` is in the schema: `topicId`, `lang`, `sellerId`, `code`, `capacity`, `pricePerSeat`
  (cents, ZAR), `orgName`, `orgContact`, optional `stoppedAt`, optional `ledgerId`, optional
  `paymentRef`. Indexes `by_code`, `by_seller`, `by_payment_ref`.
- `accessCodes.mintAccessCode` writes one row and returns the code. It refuses anybody but the
  Edition's own Seller, asserted server-side.
- It refuses a `capacity` below 1 and a negative `pricePerSeat`.
- Minting retries on code collision the way `mintBatch` does.
- A Seller may mint more than one Access Code for the same Edition, asserted, because two
  organisations are two deals with two bills.
- `accessCodes.myAccessCodes` lists the caller's own codes with a **derived** take-up count, and
  refuses to return another Seller's. There is no stored counter anywhere.
- No UI in this ticket. The Seller's section is ticket 08.
