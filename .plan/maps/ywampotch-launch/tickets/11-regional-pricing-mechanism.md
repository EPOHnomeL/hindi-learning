---
type: grilling
blocked_by: [10]
---

<!-- 10 is answered; this is on the frontier. Read 10's Answer first — it
     changes the shape of the first question below. -->

**Ask PayFast support first.** Ticket 10 turned up a **Multi-Currency Pricing**
feature (buyer picks a display currency, PayFast converts from the ZAR base
price, merchant still settles ZAR). If our account qualifies, most of this may
be configuration rather than a build — and the grilling below is then about
whether we *want* their conversion or our own fixed price points.

<!-- Note added 2026-08-01 while grilling marketplace/03 (donations). NOT a resolution
     of this ticket — just facts that arrived early, so nobody re-researches them. -->

**Partial answer on MCP, from the donations grilling.** Checked against
<https://payfast.io/features/multi-currency-pricing/> and their
[setup KB](https://support.payfast.co.za/portal/en/kb/articles/how-do-i-set-up-multi-currency-pricing):
MCP is **ZAR-base only** — the *buyer* picks a display currency from a dropdown at
checkout, PayFast shows a real-time conversion **out of** ZAR, the buyer accepts, and
the merchant still settles ZAR. **Visa/Mastercard only, no AMEX.** It sits on
PayFast's **Aggregation** solution and has a self-serve setup KB article — so
eligibility looks likelier than ticket 10 could confirm, though the support query is
still worth sending.

Two things this changes for the grilling below:

- MCP gives *display* currency with **PayFast owning the rate, its freshness and the
  buyer-acceptance disclosure** — strictly less for us to maintain than operator-set
  price points. A genuine argument in its favour that ticket 10 could not make.
- MCP **cannot take a non-ZAR base**. Any design where a number is entered or fixed
  in USD/EUR and Rand is *derived* must do that conversion itself; MCP only ever
  converts the other way. This is what pushed
  [marketplace/03](../../marketplace/tickets/03-donation-link-and-prompt.md) to a
  committed rate constant with MCP switched **off** — see decision 5 there.

If this ticket lands on MCP while 03 keeps its own constant, **the two must be
reconciled**: no single transaction should have both conversions in play.

# Regional pricing — how does $10/€10/R100 actually get charged?

## Question

The price points are decided: **$10 for US buyers, €10 for EU buyers, R100
everywhere else**. What is *not* decided is the mechanism, and the current
stack forbids the naive reading — prices are ZAR-only by validation
(`convex/market.ts:71-72`) and PayFast settles in Rand with no currency field.
With ticket 10's facts on the table, grill the operator to a decision on:

- **Charge currency.** Is "$10" a true USD charge or a *display price* whose
  charge is a fixed ZAR equivalent on the existing PayFast rail? Research says a
  true USD charge means **Paddle** (Stripe is unavailable to SA entities), which
  makes Paddle the merchant of record and so **reverses ADR 0026** — a big,
  ADR-sized move for a price label. What does the buyer's statement show, and
  does the operator accept FX drift between the displayed $10 and settled Rand?
- **Anti-surprise line.** If we display $10 and charge Rand, do we show
  "you will be charged R180.00 (ZAR)" before they commit? (Research: not
  legally DCC, but it is the honest and dispute-cheap pattern.)
- **Where regional prices live.** `listings` today is one `{amount, currency}`
  per Edition. Fixed per-region amounts set by the operator, or one base price
  plus derived regions? Who updates them when the Rand moves?
- **Region assignment.** Geo-IP at the edge (`x-vercel-ip-country` in
  `src/middleware.ts` — **Convex can't see it**, so it must be passed as an
  argument), buyer self-declaration, or card country? What does a US buyer on a
  VPN in Johannesburg pay, and do we care? **What does localhost show**, where
  the header is absent — which region is the default?
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
