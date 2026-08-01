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

## Answer

Built 2026-08-01 (`27ba5bd`) to the scope above, plus a **step rail** the
operator asked for mid-session.

- **The chooser** (`Paygate.tsx`, `BuyDialog`): with the EFT rail on, one
  "How do you want to pay?" fieldset with two equal option cards — *EFT — South
  African bank transfer* and *Visa / card — South Africa & international* — each
  one click to its details (the existing `EftInstructions` panel, or the existing
  PayFast form-POST). PayFast is named only in the card option's description, not
  its title. With the rail off the branch is unchanged from before: `bankGuidance`
  note plus the single "Continue to PayFast · R100" button. The guidance note
  moved *into* that single-rail branch — with a chooser, a buyer heading to
  PayFast has already chosen card, so the note was answering a question they'd
  been asked properly.
- **The step rail** — `CheckoutSteps`, exported from `Paygate.tsx` and reused by
  `SignIn.tsx`: Create account → Choose payment method → Pay → Continue to
  *<course>*, ticked behind, bold at, quiet ahead. It renders on the sign-in
  screen **only with the `buy=1` marker** (a plain sign-in is not a checkout) and
  at the top of the dialog. `SignIn` passes `1` as a constant — AppGate renders it
  only to unauthenticated visitors, so there's nothing to derive.
- **`checkoutDerive.ts` + 4 tests** — the one rule the rail needed: **"Pay"
  begins when a method is *started*, not merely chosen** (bank details on screen,
  or the browser being handed to the gateway). Extracted as a pure function
  beside `welcomeDerive`/`readerDerive` because the rail spans two components;
  the deliberately *un*-extracted part is step 1, which is a constant.
- **Deleted, not translated:** the `payByEft` key — the chooser's titles replace
  it. Five new title/description keys plus five step keys in all five locales.

**Money path untouched**, as scoped: `convex/` has no diff, both options call
the same `market.startCheckout` / `eft.startEftPurchase` mutations as before.

**Verified:** `pnpm typecheck` clean, `pnpm build` clean, `pnpm vitest run`
746 passed with the 4 new tests. One **pre-existing, unrelated** failure —
`scripts/bundle-authoring-assets.test.ts` — see the map's note.

**Not verified, and it needs a human:** nobody has *seen* the chooser. It only
renders when `eft.eftDetails` returns details, i.e. the rail is configured and
enabled, which is true on no environment yet. Fold the visual check into
ticket 07's prod pass — the buyer-facing claim there now includes this screen.
