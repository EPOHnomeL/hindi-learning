---
# Built 2026-08-18 (the vouchers map, tickets 01-07): every decision below is in the
# code and under test. Only the status line changed - an ADR is never rewritten to
# correct it; a stale one gets a superseding ADR.
status: accepted
# Superseded IN PART by ADR 0031 (2026-08-23): the rejection of "One code with N
# uses" below, and decision 3's "records nothing about who redeemed", are reversed
# for a SECOND rail (shared capped Access Codes with nickname Seats). Everything
# else here, including this whole single-use voucher rail, stands unchanged.
superseded_in_part_by: 0031
---

# Seller-minted voucher batches, and redemptions that record nobody

Decided 2026-08-18.

## Context

An organisation wants to buy course access for its people and **will not hand over a list of their
email addresses** - the first prospect being a political party. Every access path the platform had
requires knowing the holder in advance: `market.grantEntitlement` takes an email per person, both
payment rails derive the buyer's email from a signed-in account
([ADR 0021](0021-open-signup-allowlist-gates-course-creation.md)), and a **Share** is granted to a
named address. So the organisation cannot be served at all without inverting who identifies the
holder: a code minted *before* anyone knows who will hold it, redeemed by the holder themselves.

## Decision

A **Voucher Batch** is N single-use **Vouchers** for one **Edition**, and three things about it are
deliberate and each one is the surprising choice:

1. **The Seller mints it, not the operator.** The Seller sets the total and owns the commercial
   relationship. The sysadmin never sees or touches a code; their only act is logging the bank
   reference the money arrived under. This is the one place a Seller sets a price the platform did
   not compute, and it is correct because a bulk deal *is* a negotiation, and the Seller is the
   party negotiating.
2. **Codes are live at creation; the cash log is bookkeeping, not a gate.** An **EFT Intent** grants
   nothing until the operator confirms it; a batch is the exact opposite. Creation writes one Ledger
   row for the whole batch - the money event is the *batch*, not the redemption - held **unpaid** and
   excluded from `ledger.owedPayouts` until the reference is logged, so no Seller is ever shown owed
   a share of money nobody received.
3. **A redemption records that it happened, and nothing about who.** The Voucher stores `redeemedAt`
   and no user id, *and* the minted Entitlement carries no voucher provenance - no batch id, no code
   id, neither `pfPaymentId` nor `eftRef`. A voucher seat is byte-identical to an Admin comp.

The organisation is **not an entity**: it is a name and a billing contact on the batch. It holds no
account, and redemption counts are all it is ever shown. Redemption is auth-first on a single
`/redeem` route available on every host, minting onto the signed-in caller and never onto a typed
email. Vouchers never expire; a batch may be voided, which stops unredeemed codes only.

## Considered and rejected

- **A nicer Admin comp UI.** `grantEntitlement` already comps by hand. Rejected because it needs an
  email per person, which is the precise thing the organisation refuses to supply.
- **One code with N uses.** One broadcast distributes it, and one forward drains the paid-for seats
  to non-members. There is no refund rail to make the buyer whole.
- **Storing `redeemedBy`, operator-only.** Recommended during design and rejected by the operator.
  It buys answerable support and revocable batches at the cost of the privacy promise being "the
  organisation cannot see it" rather than "it was never recorded".
- **The organisation as a whitelabel tenant.** Tenancy is a visibility filter and a skin
  ([ADR 0022](0022-tenant-subdomain-model.md)), not a purchasing identity, and it forces the buyer
  onto a branded site they did not ask for.
- **The Seller collecting the money and remitting the platform's cut.** Ends the operator's sole
  merchant-of-record position ([ADR 0026](0026-manual-eft-payment-rail.md)) and turns the Ledger
  from a record into an invoice.

## Consequences

These are accepted, not overlooked:

- **An unpaid batch has already granted its seats**, and given decision 3 they cannot be found or
  revoked. Voiding a batch stops only what is unredeemed. This is the Seller's commercial risk,
  which follows from the Seller owning the deal.
- **"My code says it is already used" is unanswerable.** There is no record of who used it. This is
  the direct, intended cost of decision 3.
- **No report attributes a reader to a batch.** The sales report can say an organisation bought 100
  seats and that 43 codes were spent; nothing connects a specific learner to the organisation that
  paid for them.
- **A fourth Entitlement writer exists** and is invisible in the data. Anyone auditing entitlements
  by provenance will find voucher seats filed under "Admin grant or legacy row" - which is why this
  ADR exists, so the next reader does not "fix" it by adding the provenance field back.
