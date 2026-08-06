---
type: task
blocked_by: [20]
---

> `/wayfinder .plan/maps/ywampotch-launch/tickets/21-regional-pricing-surfaces.md`

# Build regional pricing — the seller's three fields and the buyer's two numbers

## Question

**Read [ticket 11's Answer](11-regional-pricing-mechanism.md) first**, then
[20](20-regional-pricing-backend.md), whose chokepoint this renders. This is the
visible half.

- **Seller side.** `SellEdition` in
  [Editions.tsx:666](../../../../src/app/_components/Editions.tsx) today has one
  amount field. It gains two optional ones — **$ and €, typed in the foreign
  currency** — with the existing blank-means-not-priced behaviour extended:
  leaving them blank means that region pays the base Rand price.
- **Buyer side, both surfaces.** The `Paygate` card and the checkout page summary
  show the buyer's regional price with the **anti-surprise line** (ticket 11 §3):
  **"$10.00 — charged as R180.00 (ZAR)"**. A base-region buyer sees R100 and no
  second line, because there is no conversion to disclose.
- **The country has to reach them.** Read the header 20 stamps in a server
  component and pass it down; it is an argument to the Convex calls, never
  something Convex can look up.
- **Method chooser.** Outside ZA, the EFT option is not rendered (ticket 11 §6).
  With the rail off, nothing changes — the chooser already collapses.
- **i18n.** New strings across all five locales, same as ticket 17 did.

`tdd` then `ponytail`. **This lands in the same surfaces as ticket 13** — the map
warns that whichever ships second inherits the merge, and 13 is already built, so
that is this ticket.

**Judged by the operator's eye** per the map's Rules, and their walk is part of
this: a Rand figure that reads wrong to them is a defect here, not a nitpick.

## Done when

A seller can set $ and € prices on an Edition; a buyer whose country resolves to
`us`/`eu` sees the foreign price with the Rand line on both the Paygate card and
the checkout page, and a base-region buyer sees today's Rand price unchanged;
EFT is absent outside ZA. `pnpm typecheck` and `pnpm test` green. The operator
has walked it and is happy.
