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

## Answer

Built. `convex/accessCodes.ts` is the new seam; `convex/accessCodeFormat.ts` beside it holds the
code string (the `voucherCode.ts` sibling, so `/join` can normalise as the member types without
pulling a server module into the browser bundle).

**Schema.** `accessCodes` with `topicId`, `lang`, `sellerId`, `code`, `capacity`, `pricePerSeat`
(cents, ZAR), `orgName`, `orgContact`, optional `stoppedAt`, `ledgerId` and `paymentRef`, indexed
`by_code`, `by_seller` and `by_payment_ref`. `ledgerId` is optional here and required on
`voucherBatches`, and that one difference is the whole rail: a batch's total is known at mint, an
Access Code's is not.

**The code format is a different shape, not just a different prefix.** `GRP-7K4-Q2X-9MB` against a
voucher's `MYC-7K4Q-2XR9`: three groups of three, because this is the code that gets *dictated* at a
meeting and threes are the phone-number rhythm, where the voucher's fours are for copying off a
card. Both rails can be live on one Edition at once, so a Seller or a member must be able to tell
them apart at a glance rather than by reading three characters. 32^9 (about 3.5e13) is an order of
magnitude more entropy than a voucher's 32^8, deliberately: a guessed voucher grants one seat and
dies, a guessed Access Code grants seats up to the cap and bills the organisation for them.

**`sellableTopic` is shared with `vouchers.ts` rather than copied.** Both bulk rails have to answer
"may this Seller sell N seats of this Edition?" identically, and two copies of a four-gate
authorisation check is two places for one gate to be forgotten. It was exported and its two
batch-specific messages generalised ("before selling seats"); no test asserted on them.

**Bounds.** `capacity` is an integer in 1..5000 (the ceiling is about a mistyped cap producing a
bill nobody agreed to, and about `myAccessCodes` counting by reading). `pricePerSeat` must be a
positive integer: zero is refused as well as negative, because a free shared code is a free
published Edition, which the platform already has, and a R0.00 settlement line is a puzzle the
operator does not need. Organisation and billing contact are both required and trimmed.

`mintAccessCode` returns `{ accessCodeId, code }`, not just the id: the Seller's very next act is
handing the code to the organisation, and a mint that returns only an id sends them looking for it.
Collision retries five times exactly as `mintBatch` does.

`myAccessCodes` returns capacity, a **derived** `taken`, `pricePerSeat` and a `runningTotal` of
`taken * pricePerSeat`, so the Seller's running total and the operator's settlement line cannot
disagree. It refuses another Seller's codes and returns `[]` signed out (the dialog mounts it before
auth settles). There is no counter field anywhere.

**One thing the returns validator does that is worth naming:** the rows exist on this rail, unlike
on the voucher one, so "who took a seat" is a query that *could* be written here. It is not, and the
validator is why: no `userId`, no `nicknameKey`, no breakdown of the count by anything. Tests assert
it in ticket 03.

Six tests in `convex/accessCodes.test.ts`, and no `accessCodes` or `seats` row is ever
hand-inserted. No UI (ticket 08).
