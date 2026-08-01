---
type: task
blocked_by: [12]
---

# Move the purchase out of BuyDialog and onto the page

> `/wayfinder .plan/maps/ywampotch-launch/tickets/13-move-purchase-out-of-buydialog.md`

## Question

Build the page ticket 12 decided. Everything `BuyDialog` does today moves onto
it, as page sections rather than dialog contents:

- the course + price header;
- the **"How do you want to pay?"** chooser (EFT — South African bank transfer /
  Visa — SA & international), built in ticket 09 and unchanged in substance;
- `EftInstructions` — the reference and bank details, which are the loudest
  things on the panel because a buyer retypes them into a banking app, usually
  on a phone;
- the pending-EFT state for a returning buyer;
- the error line, the PayFast note, and the terms/refunds agreement line.

`BuyDialog` is then deleted, not left behind as a second way to buy — two paths
into the money surface is how the divergence starts.

**Rules that are not negotiable here:**

- **`convex/` is untouched.** `git diff convex/` must be empty. Same
  `market.startCheckout` (signed field set, form-POST to PayFast's hosted
  checkout) and `eft.startEftPurchase`. The PayFast path holds real money.
- The **single-rail branch still has to work** — `eftDetails` returns null when
  the rail is off or unconfigured, and that branch (the `bankGuidance` note plus
  one card button) must survive the move. The rail is on in dev and prod today,
  but "off" is still a reachable state and it is what every other tenant sees.
- All new strings through the five `messages/*.json` locales, as
  `Checkout.*` keys are done today.
- `tdd` then `ponytail`. Tests seed only states production can produce — name
  the mutation that would create a fixture before writing it.

## Done when

Both entry paths reach the checkout page and complete a purchase on both rails —
EFT to a reference and bank details, card to the PayFast redirect. `BuyDialog` is
gone. The EFT-rail-off branch still renders the single card button. `git diff
convex/` is empty. `pnpm typecheck` and `pnpm test` green, allowing for the two
pre-existing failures named on the map. All five message files carry the keys.

## Answer

Built in `f971945`, exactly the shape ticket 12 decided — nothing reopened.

**New:** `src/app/(app)/checkout/[slug]/[lang]/page.tsx` (a five-line server
component that awaits `params`) and `src/app/_components/CheckoutPage.tsx`, which
holds everything `BuyDialog` rendered, as page sections: summary (title / edition
/ price), the "How do you want to pay?" chooser, `EftInstructions` (moved here
whole, out of `Paygate.tsx`), the pending-EFT state, the error line, the PayFast
note and the terms/refunds line. `CheckoutSteps` sits in its own card above the
body and carries nothing but the four one-word steps.

**Deleted:** `BuyDialog`, `Paygate`'s `autoOpenBuy` / `buying` / dialog mount /
`courseTitle`, `useBuyMarker()`, `PublicReader`'s `buyLink()`, and the two
`ArtifactView` marker call sites. `Paygate`'s CTA is now one `<Link>` on both
entry paths, and its pending-EFT note links to the route ("See your reference and
bank details" — `eftPendingLink`). `SignIn` keys the rail and the `signUp`
default off `usePathname()?.startsWith("/checkout")`.

**One thing 12 didn't foresee, and it is not a deviation but a consequence.**
`courseHeader` reports `role !== "preview"` for anyone who already holds the
Edition, and on a *page* that is reachable — a holder opens the URL, or, the case
that matters, an EFT buyer leaves the tab open until the operator confirms and
watches the grant land under them. Left unhandled they'd be shown a chooser whose
buttons both throw server-side. So `checkoutStep` grew a fourth step:
`{entitled}` → 4, winning over both payment states, because either can be left
behind by the grant that ends them (`checkoutDerive.test.ts` covers both). The
page then shows "This course is yours" and a link to the course. **This is step 4
arriving live, which is the argument for a page over a dialog made concrete** —
and it is the EFT rail's answer to what PayFast's `return_url` already does for
the card rail.

**Facts for later tickets:**

- `git diff convex/` is **empty**. The PayFast form-POST moved verbatim; nothing
  in it was retyped.
- **The EFT-rail-off branch survives** — `eftBank == null` still renders the
  `bankGuidance` note plus the single card button. That is the branch every
  non-YWAM tenant sees and it is untouched in substance.
- Five new `Checkout.*` keys in all five locales: `courseUnavailable`,
  `ownedTitle`, `ownedBody`, `continueToCourse`, `eftPendingLink`.
- `readerDerive.test.ts`'s stale `buy=1` case was **retargeted, not dropped**, to
  `purchase=return&lang=en` — `courseIndexRedirect` still has to prove it carries
  an explicit `en` alongside other params, and `purchase`/`mp` is the carrying
  that's still load-bearing.
- `pnpm typecheck`, `pnpm build` and `pnpm test` are green but for the
  long-standing `convex/sales.test.ts` flake. The second known failure
  (`scripts/bundle-authoring-assets.test.ts`) **now passes** — someone regenerated
  the bundle in `6588d8c`, so that staleness is closed and the map's "two
  pre-existing failures" note is down to one.

**Not verified here, deliberately:** no purchase was completed on either rail —
that needs the operator's hands in dev, and the map's rules make their eye the
bar for 12–15. Ticket 15 walks it on prod. Nothing about the flow was checked in
a browser this session; the evidence is a clean build with the route registered
(`ƒ /checkout/[slug]/[lang]`), a green suite, and a line-by-line move.
