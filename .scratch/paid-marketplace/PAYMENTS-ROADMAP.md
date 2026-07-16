# Payments roadmap — gated, subtraction-not-accumulation

_Added 2026-07-08 to the `feat/paid-marketplace` worktree context. This is the
**governing payments strategy**. It outranks build momentum: when in doubt, do
less and hold the gates._

> **PIVOT — 2026-07-08.** Phase 1's gateway is now **PayFast**, not Paystack, and
> it is a **full replacement** of the built Stripe Connect spine — Stripe is being
> **ripped out**, not run alongside. This decision is **not yet locked**: it must
> be pressure-tested with the `grilling` skill before building — chiefly *does
> PayFast support marketplace splits to individual sellers in SA, or must the
> owner be the sole seller-of-record?* (that answer decides whether the
> multi-seller model survives). The gated, phase-by-phase shape below still holds;
> substitute **PayFast for Paystack in Phase 1**, and see the Phase 2 note on why
> a PayFast Phase 1 changes the "cheap expansion" logic.

## Relationship to what's already built (read this first)

The code in this branch is a **Stripe Connect** marketplace: direct charges on
the seller's connected account + a 15% application fee, webhook-granted access
(see `docs/adr/0016-*`, `HANDOFF-stripe-dev-paygate.md`, auto-memory
`paid-marketplace-economics`). **Under the PayFast pivot, this Stripe Connect
spine is slated for full replacement, not launch.** It is *not* the Phase 1 path
for the target market (South Africa). Its only remaining future is the
**US/EU/high-VAT MoR trigger** far downstream (see the closing section) — and even
that is more likely a Paddle-style MoR than this Connect code. Do not treat the
Stripe work as the money path for launch. **Open question the grilling must
settle:** confirm PayFast fully replaces Stripe now (memory says yes), and what,
if anything, of the Connect spine is worth keeping for the eventual MoR path
vs. deleting outright.

## Governing principle

International adoption is where a solo course business over-builds before demand
exists. Every phase is **gated**: you don't touch the next until the current one
clears a real bar. Subtraction, not accumulation.

**The ruthless summary: Phase 1 is the only phase that matters right now.**
Phases 2–4 are contingencies, each unlocked by *evidence, not ambition*. Building
Phase 3 plumbing before Phase 1 has sold is the mistake. Write the gates down and
hold to them.

---

## Phase 1 — South Africa foundation (PayFast). Now.

Ship **PayFast** for **ZAR card + Instant EFT**, priced **R100–R500**.

- Want to sell *this week*? Start with **PayFast payment links / a hosted payment
  page** (one per course, zero code). Move to the **API / on-site integration**
  only when you want checkout inside the app.
- **Grill first (blocking):** does PayFast support **marketplace splits to
  individual sellers**, or must the owner be the **sole seller-of-record**? PayFast
  is SA-domestic and not a Stripe-Connect-style facilitator by default — if it
  can't split, the multi-seller marketplace collapses to a single-seller storefront
  (owner sells everything, pays creators out-of-band). Settle this before building.
- Get **SARS/tax basics** clean from day one — you're the **seller of record**, so
  income tax is yours, and VAT becomes yours if you cross the **R1m** threshold.

**Gate to Phase 2:** consistently selling — ~**100+ paid courses/month** with a
refund/chargeback rate you understand. If you can't sell to South Africans, adding
countries won't fix it — it multiplies the problem.

## Phase 2 — English-speaking, card-friendly Africa. (No longer "cheap".)

Nigeria, Ghana, Kenya, Rwanda, Côte d'Ivoire.

- **The PayFast pivot breaks the old "same processor family" logic.** PayFast is
  **South-Africa-only** — it does *not* extend to the rest of Africa. So expanding
  beyond SA means standing up a **second gateway** (Paystack for these card
  markets, or straight to Flutterwave in Phase 3), not flipping a setting. Phase 2
  is now a real integration, not a cheap add-on — weigh whether to skip it and go
  SA → Flutterwave directly.
- **Paystack (if chosen here) is country-specific.** A NG/KE account with local
  rails + settlement needs a **separate account tied to a local entity**, not a
  cross-border switch from SA.
- **Price locally per market** — a Kenyan won't pay a ZAR price. Card-only reach in
  these markets still skews urban/affluent.

**Gate to Phase 3:** real demand from a **mobile-money** market (Kenya, Ghana, …)
that cards alone can't capture.

## Phase 3 — Mobile-money Africa (Flutterwave). The real complexity jump.

Add a **second processor** — cards/Paystack don't reach the majority. Flutterwave
covers SA-based merchants and supports **M-Pesa, MTN/Ghana/Uganda/Rwanda/Tanzania
Mobile Money, USSD, and cards** at **percentage-only fees (~2.6–4.8%)**, no
punishing fixed fee. Now you run **two gateways** and reconcile both.

Plan for these, don't discover them:
- **FX & repatriation** — NGN/KES landing has to come back to a SA account:
  conversion cost + South African exchange-control (**SARB**) considerations.
- **Tax** — no MoR means foreign VAT/GST is technically yours as volume grows.

**Gate to Phase 4:** African revenue is **material** *and* India demand is **proven
by real signals** (waitlist, traffic, requests) — not a hunch.

## Phase 4 — India. Separate beast; maybe never.

Its own build, not an extension. **UPI is >80%** of Indian digital payments; the
tool is **Razorpay**, domestic-focused and (verify directly) appears to want an
**Indian entity** to onboard a merchant — from a pure SA base it may not be
feasible without a local partner/entity. India also has **GST on digital services**
to Indian consumers (**OIDAR** rules) landing on you. Treat as a genuine funded
project or **park it indefinitely**. Don't let "India" sit on the launch checklist.

---

## Cross-cutting: when to abandon this stack for a Merchant of Record

The whole roadmap assumes you **own tax** and run multiple gateways to keep fees
low on cheap courses. Flip to a **Paddle-style MoR** only when **both** are true:

1. A meaningful share of revenue comes from **EU/US/high-VAT** jurisdictions.
2. Average course price rises **well above ~$30**, so the MoR's fixed fee stops
   hurting.

Then MoR flips from "wrong" to "worth it" — it collapses tax compliance across all
markets into one integration. **Re-evaluate at that point, not before.**

This is the *only* trigger under which the built Stripe Connect spine could earn a
second life — but even here a purpose-built **Paddle-style MoR** is the likelier
tool, since Connect makes *you* the tax-liable facilitator (the exact thing an MoR
exists to remove). So: don't preserve the Stripe code *for* this; if it survives
the pivot at all, revisit it here on its merits. **Note on PayPal:** PayPal is a
payment *method*, not an MoR — it does not file EU VAT / US sales tax for you, so
it does **not** solve the Western problem this section is about. If PayPal is
wanted for buyer trust, that's a separate deliberate call, not part of this
strategy.
