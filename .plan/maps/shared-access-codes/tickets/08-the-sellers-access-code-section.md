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
