---
type: grilling
blocked_by: [01]
---
# What "off" does to live data, switch by switch

## Question

Frozen-not-revoked is settled at the level of the slogan: a flip stops new grants and touches
nothing already granted. It is not settled at the level of any individual money switch, and the
money switches are where the slogan stops being obvious.

Work through each switch [01](01-the-tenant-switch-inventory.md) landed on and say precisely what
becomes impossible, what keeps working, and what the operator sees. The hard cases, named:

- **Selling off.** Course-publishing ticket 02 already decided the shape: gate `setEditionPrice`
  and `startCheckout`, leave the listing in place, leave existing buyers untouched, and leave
  `clearEditionPrice` **un-gated** so an owner can always drop a stuck price back to free. Confirm
  or amend it, and answer what happens to a checkout intent that is mid-flight when the switch
  flips, and to a pending EFT intent awaiting operator confirmation.
- **Bulk Vouchers off.** A minted batch is a **sold deal**: the Ledger row is written at mint, held
  `unpaid`, and the codes work immediately. Does an already-minted, unredeemed code still redeem
  after the switch goes off? Refusing it repudiates a sale the operator has already invoiced.
  Allowing it means "off" does not mean off for possibly months.
- **Organisation Vouchers off.** Worse, because the Ledger row is written when the Seller **stops**
  the code, so the total is unknown until the agreement ends. Can a live capped code still take
  joins? Can the Seller still stop it and get billed? Can they still raise capacity?
- **Catalogue and publish off**, if 01 gave it a switch. Publishing is visibility, not an
  acquisition gate (ADR 0024), so an off switch that unlists a published Edition is a read-path
  change, and read paths have never been flag-gated. Say whether that stays true.
- **Generation off**, if 01 gave it a switch. A Routine run already in flight, and a scheduled
  daily fire, both need an answer.

The unifying question underneath: **is frozen-not-revoked a rule about the create path, or a rule
about grants?** Today it is enforced as the former, since `assertTenantFlag` is only ever called on
create. A voucher code minted but not redeemed is neither: the create already happened, the grant
has not. Pick one reading and apply it consistently.

## Done when

- Each switch from 01 has an explicit off-semantics line: what is refused, what still works, and
  what the operator sees when they flip it.
- The minted-but-unredeemed voucher case is answered for both rails, with the money consequence
  stated.
- The create-path-versus-grant reading is picked and stated in one sentence, and every switch above
  is consistent with it.
- Any switch whose off-semantics cannot be frozen-not-revoked is named as such, so the map's Out of
  scope line is either upheld or challenged in the open rather than by accident.
