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

## Answer

Built 2026-08-01, commits `2d3e6ea` (the shared PayFast post) and `7cc2341` (the widget).
785 tests pass; `tsc` clean; `next build` clean. Every item of the work list landed except
the **live sandbox run**, which is not a thing this session can do — see "Left for the
operator" at the bottom, which is a checklist, not a deferral.

### What it is

`src/app/_components/DonateSection.tsx`, a `<section id="donations">` that renders itself
only when `tenant.flags.donations` is on, plus `donateDerive.ts` beside
`checkoutDerive`/`welcomeDerive` for the pure half (11 unit tests).

The widget makes **one** server call and it is the query 07 built: nothing is fetched until
the donor clicks, and nothing at all is written. It is called imperatively through
`useConvex().query(...)` rather than reactively with `useQuery` — deliberate, and the reason
is error handling: a `useQuery` that throws (flag switched off mid-session, payee readiness
revoked, PayFast unprovisioned) throws *during render*, taking the whole landing page down
with an error boundary. Imperative, it is a caught failure and one line of red text under a
button.

### Three things decided here, since neither 03 nor 07 said

1. **The default `<Landing/>` picks the section up automatically; `YwamPotch.tsx` places it
   by hand.** The ticket asked. A bespoke page is bespoke — the flag controls whether it
   renders, not where, so ywampotch gets a hand placement (after the course CTA, before
   sign-in: a visitor who came to buy is not asked for a gift first). But a tenant *without*
   a bespoke page should not need a code change to be able to switch a flag on, so the
   shared page carries it unconditionally and the flag does the gating.
2. **The ZAR figure is computed client-side, from the rate in `donations.config`.** The
   anti-surprise line has to be on screen *before* the click that fetches the signed fields,
   so it cannot quote `checkoutFields`'s `zarCents`. It mirrors the server's
   `Math.round(usdCents * USD_ZAR_RATE)` with the rate read from the same committed
   constant — the two can only agree, and a unit test pins the formula. (The alternative,
   a two-step confirm screen quoting the signed number, buys exactness at the cost of a
   click on a donation form. Not worth it.)
3. **The PayFast return URL gained the `#donations` anchor** (`/?donation=thanks#donations`,
   a one-line change in `convex/donations.ts`). Without it a returning donor lands at the
   hero of a long page with the thank-you off screen, which reads as "nothing happened" —
   exactly the failure the ticket said to avoid. The thank-you itself is generic and
   *acknowledges without claiming*: PayFast will email a confirmation, and it is not a
   tax-deductible receipt. A **cancelled** payment returns to the bare `#donations` anchor
   with no marker, so it correctly shows the form again and no false success.

### Smaller things worth knowing

- **The parse is strict and never `parseFloat`.** `parseFloat("1e3")` is 1000 and
  `parseFloat("5abc")` is 5 — both are a charge the donor did not choose. A leading `$` and
  genuine thousands commas are forgiven; `"5,5"` (a European decimal comma) is refused
  rather than becoming $55.
- **The Rand is hand-formatted** (`R18 400.00`), not `Intl.NumberFormat`: this is the number
  the card is charged and it must read identically for a donor whose browser is `hi-IN`
  (which would group it the Indian way) as for `en-ZA`.
- **The floor, the rate and the 10% are interpolated from `donations.config`** into the
  message catalogues, so the copy cannot drift from the constants. ADR 0027's consequence
  bullet saying the take-rate "is now stated in two places" was corrected accordingly.
- **The PayFast form post is now shared** (`payfastPost.ts`) between the sale rail and this
  one, so the field-order rule — reorder the signed fields and the signature is corrupt —
  is stated once, in the only function that could break it.
- **Copy is a new `Donate` next-intl namespace in all five catalogues**, including on the
  ywampotch page whose own copy is hand-authored English. That is the right split: the
  ministry's marketing is theirs, but the money disclosures in this section are ours.

### One limitation, stated rather than fixed

**A signed-in visitor cannot reach the section.** `/` renders `<Landing/>` only while
`<Unauthenticated>`; signed in, the same URL is the Dashboard. That follows from 03's
decision that the donor is a Guest, and the shared link is aimed at strangers — but an
operator who is logged in and opens `#donations` to check their own page will see a
dashboard and think it is broken. Not fixed here (the surface 03 chose is the landing page);
worth knowing before someone reports it as a bug.

### Revised on contact with the operator, 2026-08-02

Two rounds of feedback on the live page, both worth recording because they reverse
things written above and in ADR 0027.

1. **The disclosures came out of the widget.** As built it showed the exact rand charge in
   a callout, the platform's 10%, and the not-a-tax-deductible-receipt line — three
   disclosures stacked under four chips. The operator's verdict on sight: *"tooo much
   information… it is a donations widget, it should handle donations"*. All three moved to
   **terms clause 5 (Donations)**, which now covers the ZAR conversion, the operator's cut,
   the Section 18A position and the once-off/non-refundable terms; the widget keeps one line
   linking there and quotes dollars on the button. **This reverses item 3 of the work list
   and 03's §4**, which called the rand line load-bearing rather than polish — so ADR 0027
   was edited to say so outright rather than quietly disagree with the code. The donor still
   sees the rand figure before money moves, on PayFast's own page one click later; what was
   lost is it appearing one screen earlier. `donateDerive` lost its conversion and
   `formatZar` with it — `zarCentsFromUsdCents` in `convex/donations.ts` is the one that
   signs and always was.
2. **The flag would not switch on in prod, and said "Server Error".** The
   `isReadySeller` precondition was working exactly as designed; the message was invisible,
   because **a production Convex deployment redacts a plain `Error` before it reaches the
   client**. Only `ConvexError`'s data crosses that boundary. So the three refusals on this
   path (`setTenantFlags`'s donations gate and `setDonationPayee`'s two) are `ConvexError`
   now, with a `mutationError` helper in the admin panel reading `e.data` first, and a test
   pinning it — the failure is invisible in dev, so only a test keeps it fixed. **Worth
   generalising**: every other admin mutation in this codebase throws plain `Error` with a
   carefully-worded message that prod also swallows. Not swept here; noted on the map.
   In the same pass the payee text field became a **picker over ready sellers**
   (`sellers.readySellerEmails` — deliberately not `listSellers`, which is the one read that
   returns payout bank details), which makes two of those three refusals unreachable.

### Left for the operator — the live sandbox run

Everything above is verified by tests and a clean build; **the end-to-end sandbox donation
is not**, and it cannot be from here (it needs a real deploy, a browser, and PayFast's
hosted card page). The checklist:

1. Sys admin → Tenants → set a `donationPayee` for the tenant and switch the `donations`
   flag on. The mutation refuses unless that user is a ready Seller.
2. Open `https://<tenant>.my-course.app/#donations` **signed out**. Section renders; chips
   work; `$4` in the custom field is refused before any request leaves the browser.
3. Donate $5 with a PayFast sandbox card. Confirm the Rand figure shown matches the amount
   on PayFast's page — that is the one number a divergence would show up in.
4. Back on `/?donation=thanks#donations`: the thank-you is on screen, not off it.
5. Admin → **Payouts**: exactly one new `owed` row, payee correct, 90/10 split. Admin →
   **Sales**: unchanged.
6. An unflagged tenant's landing page renders no section at all.
