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
