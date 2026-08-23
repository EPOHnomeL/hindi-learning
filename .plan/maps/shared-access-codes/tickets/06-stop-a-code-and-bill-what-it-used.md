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
