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
