---
type: research
blocked_by: []
---

# Research — can this stack charge $10/€10, and how does it know where a buyer is?

## Question

The regional pricing ask is "$10 from the US, €10 in the EU, R100 everywhere
else" — but the entire money path is hard-wired ZAR: `market.setEditionPrice`
throws on any currency but `"zar"` (`convex/market.ts:71-72`), and PayFast's
signed field set has **no currency field at all** (`convex/payfast.ts:167-194`)
— ZAR is implicit in the merchant account. Before the pricing decision
(ticket 11) can be grilled, we need facts, not vibes:

1. **PayFast and foreign currency.** Does PayFast support charging in USD/EUR
   at all, on any account type? If not (expected), confirm from primary docs
   that international Visa/Mastercard *are* accepted and the cardholder is
   charged the ZAR amount, with their issuer doing FX. What does PayFast
   itself recommend for international buyers?
2. **If a true multi-currency charge is wanted, what's the realistic rail?**
   Survey just enough to name options and their cost/KYC burden for a South
   African operator: Stripe (note ADR 0016 proposed Stripe Connect in the
   pre-PayFast marketplace era — what of it still applies?), Paddle/Lemon
   Squeezy-style MoR, PayPal. One paragraph each, no deep dive.
3. **Buyer region detection on this stack.** The app is Next.js middleware on
   Vercel (`src/middleware.ts`, no geo code today). Confirm what
   `x-vercel-ip-country` / the geolocation helpers give us, in middleware and
   in Convex functions (which run off-Vercel — can they see it, or must the
   client/middleware pass it?), plus accuracy caveats (VPNs, proxies).
4. **Display-price maths.** If the charge stays ZAR, what are sane mechanics
   for showing "$10" and charging its ZAR equivalent — fixed operator-set
   regional amounts vs live FX? (Fixed per-region ZAR amounts is the expected
   ponytail answer; note what a live-FX approach would drag in.)

## Done when

The Answer states, with primary-source citations: whether PayFast can charge
non-ZAR (yes/no, account types); how international cards behave on the current
rail; what geo signal is actually available to middleware and to Convex;
and a one-paragraph-per-option survey of true multi-currency rails — enough
for ticket 11's grilling to be about *choices*, not facts.

## Answer

Researched 2026-08-01 against primary sources. **Ticket 11 can now be a
conversation about trade-offs, not facts.** The headline: nothing forces a new
payment rail — the "$10/€10" ask is satisfiable as *presentment* on the PayFast
rail we already have, and the one genuinely new mechanism needed is geo, which
is a header we're not reading yet.

**1. PayFast is ZAR-only for charge and settlement — but takes international
cards.** Its card page markets "Receive local and international payments **in
ZAR** with Visa and Mastercard"
(<https://payfast.io/features/payment-methods/credit-cheque-cards/>). An
international cardholder is charged the ZAR amount and their *issuing bank*
does the FX. So the existing rail already serves US/EU buyers — the gap is
purely what price we show them.

**Unexpected and directly relevant:** PayFast markets a **Multi-Currency
Pricing** feature — the buyer picks a display currency at checkout, PayFast
converts from the ZAR base price, merchant still settles in ZAR; Visa/Mastercard
only (<https://payfast.io/features/multi-currency-pricing/>). Eligibility per
account type isn't documented, so **ticket 11 should open with a support query
to PayFast** — if our account qualifies, most of the regional-pricing build may
already exist upstream.

**2. True multi-currency rails, if wanted.** *Stripe is out*: South Africa is
"Extended network" only, routed to Paystack — an SA entity cannot open a normal
Stripe account (<https://stripe.com/global>), and Stripe Managed Payments
inherits that. *Paddle is the viable MoR*: it supports sellers anywhere except a
~28-country exclusion list that does not include South Africa
(<https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle>),
charges buyers in many currencies, and takes on global VAT/GST as seller of
record — which would **reverse ADR 0026's operator-is-merchant-of-record
decision**, so it is an ADR-sized change, not a config change. *Lemon Squeezy is
winding down* into Stripe Managed Payments — a bad bet for a new integration.
*PayPal* works for SA merchants in USD/EUR but forces FNB-routed, SARB-reported
repatriation.

**3. Geo: Vercel has it, Convex cannot see it.** Vercel sets
`x-vercel-ip-country` on every request it serves, with a `geolocation()` helper
in `@vercel/functions` (<https://vercel.com/docs/headers/request-headers>).
**Convex functions run on Convex's infrastructure, not Vercel**, so those
headers never reach a query or mutation — `src/middleware.ts` (or a route
handler) must read the country and pass it explicitly as an argument. Caveats
that matter for pricing: the header is **absent on localhost**, so dev never
sees a country and needs a default; and VPNs/proxies defeat it, so it is a
default, not a truth.

**4. If the charge stays ZAR, fixed beats live FX.** Fixed operator-set ZAR
amounts per region need no FX API and cannot drift mid-session; the cost is the
operator re-setting them as the rand moves. Live FX drags in a rates source,
rounding artifacts and staleness between page view and charge. On compliance:
the strict Visa/Mastercard rules target **DCC** (converting the actual
transaction at point of sale), which this is not — but the anti-surprise
principle carries, so the honest pattern is an explicit "you will be charged
**R180.00 (ZAR)**; your bank sets the exchange rate" line before authorization.

Full findings including the PayPal/SARB detail and DCC citations are in the
research transcript; the four points above are what ticket 11 needs.
