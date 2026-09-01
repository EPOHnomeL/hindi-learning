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

## Answer

Grilled with the operator 2026-08-06. **Decided, NOT built** — the build is
tickets [20](20-regional-pricing-backend.md) and
[21](21-regional-pricing-surfaces.md), both `blocked_by` this one.

**No ADR is needed and ADR 0026 is not reopened.** The charge rail does not
change; only what number we put in front of a buyer does.

### The PayFast support query is dead, and not for eligibility reasons

**Do not send it.** Ticket 10 told this ticket to open by asking PayFast whether
our account qualifies for Multi-Currency Pricing. It doesn't matter: **MCP is
structurally incapable of the ask**, on facts already on this ticket and
independently confirmed at
[marketplace/03 decision 5](../../marketplace/tickets/03-donation-link-and-prompt.md).
MCP takes a **ZAR base** and lets the *buyer* pick a display currency, converting
at a live rate. Give it R100 and a US buyer sees **≈$5.50** — not $10. MCP can
only ever restate *the same price* in another currency; it cannot express
**different prices per region**, which is what $10 ≠ €10 ≠ R100 is. Eligibility
was never the blocker. **MCP stays off**, matching 03, so the two-conversions
hazard this ticket warned about never arises: exactly one conversion is in play
anywhere, ours.

### 1. The $10 is price discrimination, not a translation

The grilling opened here because R100 ≈ $5.50, so "$10 for US buyers" is roughly
**double** the base price, not a restatement of it. The operator confirmed the
intent is **to charge wealthy markets more**. Everything below follows from that:
a comprehension-only reading would have been a display-formatting change with no
schema, no geo and no freeze problem.

### 2. Charge currency: ZAR on PayFast, always

**$10 is a display price; the card is charged the ZAR equivalent** on the rail we
already have, and the buyer's issuing bank does the FX. **Paddle was considered
and rejected** — a true USD charge makes Paddle merchant of record, reverses
ADR 0026, and is a weeks-long integration on the money path during launch week.
Accepted cost: the buyer's statement reads Rand, and the settled Rand drifts from
our fixed rate as the market moves.

### 3. The anti-surprise line is IN — reversed on a re-ask

The operator's first answer was "just show $10". Re-asked once against two
specifics and **reversed**: the surface holds real money and a chargeback costs
more than a string, and the donation widget on the *same tenant's landing page*
already committed to showing its Rand line (03 decision 4) — so omitting it here
would have the same tenant disclosing oppositely on two money surfaces.

Buyer sees **"$10.00 — charged as R180.00 (ZAR)"** before committing. Not
legally DCC (ticket 10), but it is the honest and dispute-cheap pattern.

### 4. Where the prices live: per-listing, typed in the foreign currency

**`listings` grows two optional foreign-currency amounts**, and the seller types
**$10.00 / €10.00** — not their Rand equivalents.

- **Per-listing, not global constants.** The global-constant option was rejected
  for a concrete bug, not on taste: constants apply to **every priced Edition on
  the platform**, so a second seller's R500 course would also become $10 in the
  US. `listings` is per-Edition and the price control is per-Edition; regional
  prices belong at the same grain.
- **Optional, absent means fall back to the base ZAR amount.** Every existing
  listing keeps working untouched — no backfill, no migration.
- **The foreign side is exact, the Rand derives.** "$10" is the whole point of
  the ask, so it is what gets stored; the ZAR charge is computed at intent time
  from a committed rate constant and **frozen onto the intent**. The alternative
  (type ZAR, derive the label) drifts the headline to "$9.87" as the constant
  ages, defeating the round number.
- **The rate constant is shared with marketplace/03.** 03 committed a USD→ZAR
  constant for donations, changed by deploy, with
  [Live USD→ZAR rate](../../technical-foundation/tickets/13-live-usd-zar-rate.md) as its
  follow-up. **This ticket reuses that same constant and adds EUR→ZAR beside it**
  — one rate per currency for the whole repo. Whichever build lands first owns
  the module; the second imports it. **This is the reconciliation this ticket's
  header demanded** and it is satisfied: one conversion, one constant, MCP off.
- **Who maintains it:** the seller types the foreign prices in `SellEdition`
  ([Editions.tsx:666](../../../../src/app/_components/Editions.tsx)); the rate
  constants are a deploy. Accepted cost, same as 03's: they go stale if nobody
  watches them.

### 5. Region assignment: header, default to the cheapest

`x-vercel-ip-country` read in `src/middleware.ts`, forwarded as a request header,
passed to Convex **as an explicit argument** — Convex runs off-Vercel and can
never see it (ticket 10).

- **No header → base ZAR price.** That covers localhost (the header is absent in
  dev), bots, and any unknown country. **Failing to the cheapest price is the
  safe direction**: the failure mode is lost margin, never an over-charge to
  defend.
- **A VPN defeats it and we accept that.** A US buyer on a Johannesburg VPN pays
  R100. Named and accepted, not mitigated. **No region picker** — offering one
  hands every buyer a legitimate route to the cheapest price.
- **"EU" is Western Europe, not the 27.** The 27 member states **plus UK,
  Switzerland, Norway and Iceland**, all seeing **€**. Chosen for the intent
  (charge wealthy markets more) over the letter — a UK buyer is exactly the buyer
  the euro price targets, and giving them R100 would be an accident. A separate
  £ price point was offered and declined: a third currency nobody asked for.

### 6. EFT is hidden outside South Africa

Not "EFT stays R100". EFT is a South African bank rail and offering it globally
at the base price **hands a US buyer a 45% discount for clicking the other
button** — the arbitrage is the whole reason this couldn't be left alone. Outside
ZA the method chooser shows the card option only. Enforced **server-side in
`eft.startEftPurchase` as well as hidden in the UI**, because the UI is not a
gate. Accepted cost: a South African on a VPN loses their preferred method.

### 7. The freeze invariant holds, and gets stricter

Both rails already freeze `amount` at intent time (`checkoutIntents.amount`,
`eftIntents.amount`) and both compute it from the same chokepoint —
`editionPrice()` in `convex/lib.ts`, called at
[market.ts:407](../../../../convex/market.ts) and
[eft.ts:166](../../../../convex/eft.ts). Regional pricing therefore needs **no
new freeze mechanism**: it changes what number reaches that insert, and the
existing invariant carries it. Two rules the build must not break:

- **The server computes the regional amount from the `country` argument.** The
  client never sends an amount. A client-supplied price on a money path is the
  one way this becomes a real vulnerability rather than a pricing feature.
- **The ITN amount match is unchanged** — it compares the paid amount against
  `checkoutIntents.amount`, which is now the regional Rand figure the buyer was
  actually shown. Nothing about `convex/payfast.ts` moves.
