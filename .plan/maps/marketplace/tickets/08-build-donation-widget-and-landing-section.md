---
type: task
blocked_by: [07]
---

> `/wayfinder .plan/maps/marketplace/tickets/08-build-donation-widget-and-landing-section.md`

# Build the donation widget and landing section

## Question

Nothing to decide: [Donation functionality](03-donation-link-and-prompt.md) settled the
shape and [07](07-build-donation-rail-backend.md) built the rail underneath. **Read 03's
`## Answer` first**; where a detail is not written there it was not decided, so grill
rather than invent.

Use `/tdd` and `/ponytail`. The derive-the-numbers logic should be a pure, unit-tested
function separate from the component, following the `checkoutDerive` / `welcomeDerive`
pattern already in `src/app/_components/`.

The work:

1. **A `<section id="donations">`** — the anchor is the requirement: the operator shares
   `<tenant>.my-course.app#donations` and expects to land on it.
2. **Preset chips $10 / $25 / $50 / custom**, dollars, with the minimum from 07's
   constants enforced in the UI as well as server-side.
3. **The anti-surprise line.** Before the donor commits, show the ZAR figure explicitly —
   "you will be charged **R920.00 (ZAR)**; your bank sets the exchange rate". 03 treats
   this as load-bearing, not polish: the donor types one currency and is charged another,
   and with a donor-chosen amount *both* numbers are live. Do not bury it.
4. **Copy stating this is not a tax-deductible receipt** — the mitigation for the Section
   18A consequence recorded in 03 and ADR 0027. Keep it plain, not lawyerly.
5. **Submit to PayFast** with the signed fields from 07's query, posting them in the exact
   order the query returns — PayFast signs over field order, so a reordering corrupts the
   signature (see the ordering assertion in `convex/purchase.test.ts`).
6. **Flag-gated rendering** on the tenant's `donations` flag, and **placement in
   `YwamPotch.tsx` by hand** — ywampotch's landing page is bespoke, so the flag controls
   *whether* the section renders, not *where*. Decide whether the default `<Landing/>`
   picks it up automatically when flagged.
7. **The return page.** 03 chose no intent table, so there is nothing to look up and the
   thank-you is necessarily **generic** — do not invent a lookup to personalise it. Make
   sure a returning donor is not shown anything that reads as a failure.
8. **i18n.** All copy through the message catalogues like the rest of the app
   (`messages/*.json`), five locales.

Not in scope, per 03: no email from us (PayFast's confirmation is the receipt), no
recurring option in the widget ([06](06-recurring-monthly-giving.md)), no EFT option, no
donation prompt on Public links.

## Done when

A flagged tenant's landing page renders a `#donations` section reachable by that anchor;
the chips and custom field enforce the minimum; the ZAR charge figure and the
not-a-tax-receipt line are both visible before committing; submitting reaches PayFast with
a valid signature and field order; an unflagged tenant renders nothing; the derive logic is
unit-tested; copy is in all five locales; and a real sandbox donation end-to-end produces
one donation ledger row visible in Payouts and absent from Sales.
