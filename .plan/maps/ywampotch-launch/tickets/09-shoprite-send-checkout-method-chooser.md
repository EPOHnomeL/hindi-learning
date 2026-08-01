---
type: task
blocked_by: []
---

# Shoprite-Send checkout — one clear method chooser, straight to details

## Question

The funnel's bones are already right (auth-first per ADR 0021: "Unlock the full
course" → SignIn defaulting to *Create account* via `?buy=1` → BuyDialog
auto-opens). What's wrong is the **method step**: the dialog leads with a
gateway brand ("Continue to PayFast · R100"), buries EFT as a secondary
"Pay by bank transfer (EFT)" button, and papers over card confusion with a
hardcoded `bankGuidance` paragraph. A buyer shouldn't need to know what PayFast
is to answer the only question that matters: **how do you want to pay?**

Reshape the BuyDialog step (`src/app/_components/Paygate.tsx`) Shoprite-Send
style — one plain question, method options named by *what the buyer has*, then
**directly** to that method's details:

- Step heading: "How do you want to pay?" (course title + price stay visible).
- Two equal option cards, named by method and region, not by gateway:
  - **EFT — South African bank transfer** → click goes straight to the
    existing `EftInstructions` (bank details + reference).
  - **Visa / card — South Africa & international** → click goes straight to
    the existing PayFast form-POST redirect. PayFast may be named in the
    card option's fine print (buyers see it on the next page anyway), but it
    is not the option's name.
- The `bankGuidance` note ("bank not in Instant EFT list → pick Credit &
  Cheque card") collapses into the card option's description line — the
  chooser framing does that job now.
- **EFT rail off ⇒ no chooser theatre**: with only one live method, skip the
  question and keep today's single-button card flow. The chooser only exists
  when there is a real choice.
- All new strings through the i18n message files (all five locales), matching
  how `Checkout.*` keys are done today.

Out of scope: any change to `convex/market.ts`, `convex/payfast.ts`,
`convex/eft.ts` or the money path — this is a presentation reshape of an
existing dialog. Regional pricing (tickets 10/11) is separate; the price shown
here stays whatever `market.editionPricing` returns.

## Done when

A signed-in buyer on a priced Edition with the EFT rail **on** sees one
"How do you want to pay?" step with two region-named options and reaches bank
details or the PayFast redirect in exactly one click from it; with the rail
**off** they see no chooser and the card path works as today; no PayFast/EFT
server code changed (`git diff` shows `convex/` untouched); `pnpm typecheck`
and `pnpm test` green; all five message files carry the new keys.
