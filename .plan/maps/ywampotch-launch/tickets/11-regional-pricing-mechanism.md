---
type: grilling
blocked_by: [10]
---

# Regional pricing — how does $10/€10/R100 actually get charged?

## Question

The price points are decided: **$10 for US buyers, €10 for EU buyers, R100
everywhere else**. What is *not* decided is the mechanism, and the current
stack forbids the naive reading — prices are ZAR-only by validation
(`convex/market.ts:71-72`) and PayFast settles in Rand with no currency field.
With ticket 10's facts on the table, grill the operator to a decision on:

- **Charge currency.** Is "$10" a true USD charge (new rail, new KYC, new ADR) or
  a *display price* whose charge is a fixed ZAR equivalent on the existing
  PayFast rail? What does the buyer's statement show, and does the operator
  accept FX drift between the displayed $10 and the settled Rand?
- **Where regional prices live.** `listings` today is one `{amount, currency}`
  per Edition. Fixed per-region amounts set by the operator, or one base price
  plus derived regions? Who updates them when the Rand moves?
- **Region assignment.** Geo-IP at the edge (per ticket 10's findings), buyer
  self-declaration, or card country? What does a US buyer on a VPN in
  Johannesburg pay, and do we care?
- **EFT interaction.** EFT is a South African rail; presumably US/EU buyers
  simply pay their regional price by card and EFT stays R100 — confirm.
- **Price freezing.** Both rails freeze `amount` at intent time
  (`checkoutIntents` / `eftIntents`); regional pricing must freeze the
  *regional* amount the buyer saw. Confirm the invariant survives.

Resolution is a decision plus a superseding-or-new ADR if the charge currency
changes; implementation is charted as its own ticket(s) after this closes.

## Done when

The Answer records: charge currency per region (and rail, if new); where the
three price points are stored and who maintains them; how a buyer's region is
assigned and the accepted failure modes; the EFT rule; and what the follow-on
implementation ticket(s) are. If a new rail is chosen, an ADR is drafted.
