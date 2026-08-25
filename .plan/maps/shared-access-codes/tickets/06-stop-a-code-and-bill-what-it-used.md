---
type: task
blocked_by: [03]
---
# Stop a code, and bill what it used

> `/wayfinder .plan/maps/shared-access-codes/tickets/06-stop-a-code-and-bill-what-it-used.md`

## Question

The money event, and the one place this rail differs structurally from the voucher rail. A batch
writes its Ledger row at mint because its total is known then. An Access Code's total is unknown
until somebody decides the agreement is over, so **stopping is what creates the row**.

The Ledger widening this needs already shipped as vouchers ticket 01: `status` is
`unpaid | owed | paid`, `kind` accepts `"batch"`, and `ledger.owedPayouts` reads `by_status` for
`"owed"`, so an `unpaid` row is invisible to payouts with no logic change at all. `salesOnly` is
already an allow-list that excludes batch rows, so exclusion from the sales report is free too.
Neither should need editing; a ticket that finds itself editing them has drifted.

**Stopping is one way.** A restart would reopen a Ledger row the operator may already have invoiced
against.

**Stopping is not a refund and not a revocation**, and the confirm has to say so in plain words.
Seats already taken keep working forever. Vouchers ticket 07 made the same distinction for voiding
a batch and is worth reading for the wording.

## Done when

- `stopCode` sets `stoppedAt` and, in the same mutation, writes exactly **one** Ledger row of
  `seatCount x pricePerSeat` at `unpaid` with `kind: "batch"`, storing its id on the code.
- Stopping a code with **zero** seats writes **no** Ledger row, asserted. Nothing to settle, no
  queue line to clear.
- The row is invisible to `ledger.owedPayouts` and excluded from the per-course sales report,
  asserted, with `ledger.ts` and `sales.ts` **unedited**.
- Stopping twice is refused, and the second call writes no second row.
- A stopped code grants no new seats and still admits existing ones. Ticket 04 asserts the second
  half; this ticket asserts the first.
- `raiseCapacity` lets the minting Seller raise the cap on a live code, refuses lowering it below the
  seats already taken, and refuses on a stopped code.
- Only the minting Seller can stop or raise, asserted server-side.

## Answer

Built. `stopCode` sets `stoppedAt` and, in the same mutation, writes exactly one Ledger row of
`seatCount x pricePerSeat` at `status: "unpaid"` with `kind: "batch"`, storing its id on the code, so
a stopped code can never exist without its bill. The row is shaped exactly like a Voucher Batch's:
`fee: 0` (no gateway took a cut, so net equals gross), the standard `splitNet` split so payout
arithmetic is identical on every rail, and `buyerEmail` is the organisation's billing contact rather
than any member's. It carries neither `pfPaymentId` nor `eftRef`; its provenance is the code row
pointing back at it.

**`ledger.ts` and `sales.ts` were not edited, and the tests assert the consequence rather than
trusting it.** `ledger.owedPayouts` reads `by_status` for `"owed"`, so an `unpaid` row is invisible
to payouts with no filter anybody could later forget to apply; `salesOnly` is already an allow-list
that excludes `"batch"` rows, so exclusion from the per-course report is free. A stopped code with
two seats is asserted absent from both.

**Zero seats writes no Ledger row at all**, asserted, and the code does not appear on
`pendingAccessCodes` either. A deal that went nowhere settles to nothing without paperwork, rather
than putting a R0.00 line on the queue for the operator to work out how to clear.

**Stopping twice is refused, not ignored**, and writes no second row. A silent second stop would
look to the Seller like it worked, and "already billed" and "just billed" are different
conversations with the organisation. There is no restart, for the reason the ticket gives: a restart
would reopen a row the operator may already have invoiced against.

`raiseCapacity` raises on a live code and is refused on a stopped one. Lowering **to** the seats
already taken is allowed, which the ticket did not ask for and is worth naming: it stops new joins
without ending the agreement, which is a thing a Seller may legitimately want mid-deal. Lowering
**below** the count is refused, because those seats exist, their Entitlements are permanent, and
nothing on this rail can find them to un-grant.

Only the minting Seller can stop or raise, asserted server-side against another Seller and against a
signed-out caller. A stop is a money event and a cap raise is a bill increase, so both are things one
Seller could otherwise do to another's deal.

A stopped code grants no new seat (`access/code-stopped`, distinguishable from `code-full` and
`code-unknown`, because only one of the three is something the member can act on) and its existing
seats keep signing in. Ticket 04 asserts that second half from the other side.
