---
type: task
blocked_by: [06]
---
# The Seller's Access Code section

> `/wayfinder .plan/maps/shared-access-codes/tickets/08-the-sellers-access-code-section.md`

## Question

Where the Seller mints the code, watches it fill, and eventually stops it. It sits in the Editions
dialog beside the existing voucher batch section, under the price control, because to the Seller
these are two ways of doing one thing and they should be next to each other.

**The Seller must never see a nickname**, and this is the surface where that promise is most likely
to be broken by somebody being helpful. The organisation's members were told nobody can see who they
are, and the Seller is the party with the commercial interest in knowing. Ticket 02's queries
already refuse it; this ticket must not add a route around them.

Vouchers ticket 08 found that a Seller needs the URL as well as the code, because a mail merge and a
printed card want different things. Here there is one code, so there is one URL, and it should be
readable enough to say out loud at a meeting.

## Done when

- The section lists the Seller's Access Codes for that Edition with live take-up (taken of capacity),
  the per-seat price and the running total.
- The join URL is stated beside the code, built from the **browser's own origin** read after mount,
  so a whitelabel Seller hands out their own domain.
- Minting is a form with capacity, per-seat price, organisation name and billing contact.
- Raising the cap is available on a live code and absent on a stopped one.
- Stopping is behind a confirm that says, in plain words, that it bills the organisation for the
  seats taken, that seats already taken keep working, and that it cannot be undone.
- A stopped code shows as stopped, with its final seat count and total, and its settlement state in a
  full sentence rather than a status word.
- **No nickname, no userId, and no member count broken down by anything** appears anywhere in this
  surface.


## Answer

Built: the `AccessCodes` section in `src/app/_components/Editions.tsx`, beside `VoucherBatches` and
under the price control, behind the same `completed` and `sellerStatus === "ready"` gates.

- Lists the Seller's codes for that Edition with live take-up (`{taken} of {capacity} places taken`),
  the per-seat price and the running total, all from `myAccessCodes`.
- **The join URL is built from `window.location.origin`, read after mount**, so a whitelabel Seller
  hands their organisation their own domain. `/join` is served on every host, which is what makes
  that correct rather than merely convenient. The code itself is shown in full beside it, because one
  code means one URL and this is the code somebody reads out at a meeting.
- Minting is a four-field form (places, price per place, organisation, billing contact) with the
  Rand-to-cents conversion the price control already uses. Its hint says the thing a Seller must not
  be surprised by, and it is the **opposite** of a batch's surprise: nothing is billed now, the bill
  comes when they stop the code.
- Raising the cap is available on a live code and **absent** on a stopped one, not disabled: there is
  no restart, and a greyed-out button invites a Seller to hunt for the thing that would re-enable it.
  The raise form states how many places are taken, so the refusal to go below that is explained
  before it happens rather than as an error.
- Stopping is behind `ConfirmDialog` with three plain sentences: it bills `{org}` `{total}` for
  `{seats}` places, everybody who already has a place keeps it for good, and it cannot be undone. A
  Seller must never mistake stopping for a refund.
- A stopped code shows a badge and its settlement state **in a full sentence rather than a status
  word**, in both directions: awaiting the transfer (with the seats and total that were raised), or
  settled against a named reference with the share payable in the next payout run. A Seller looking
  at an unsettled code should understand why their share is not payable yet instead of filing a
  support question about a missing payout.

**No nickname, no userId, and no breakdown of the count by anything** appears in this surface, and it
cannot: `myAccessCodes` has no field for any of them. That is the point ticket 02 made in its returns
validator and this ticket's job was to not route around it. There is no roster, no list and no export.
The section's header comment says so in those words, because this is the surface where the promise is
most likely to be broken by somebody being helpful.
