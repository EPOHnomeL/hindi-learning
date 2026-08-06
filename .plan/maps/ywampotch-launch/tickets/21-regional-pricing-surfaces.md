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

## Answer

Built 2026-08-06, `tdd` then `ponytail`, in two commits: the payload
(`9b35b26` — its subject line is mangled to `@`, the Git Bash here-string
gotcha that also hit `f8b55c3`; the real subject is the first body line) and
the surfaces (`dc9db73`). **823/823 tests green** (813 + 7 new in
`src/app/_components/priceDerive.test.ts` + 3 new in
`convex/regionalPricing.test.ts`); `git diff convex/payfast.ts` empty. The
Next build compiles clean — `pnpm typecheck` reports errors only in
`topics/_devanagari/*.ts`, which is **gitignored local scratch**, pre-existing
and absent from a clone.

### The question the ticket didn't ask: how does the price reach the surface?

The ticket said to pass the country down as an argument to the Convex calls,
and for the two **mutations** that is exactly what happens. But the price is
*read* through `courseHeader` / `publicCourse`, and **a reactive Convex query
subscription has no country to give it** — the country lives on the HTTP
request, and the subscription is a WebSocket that outlives it. So:

- **`buildPaywall` now ships all three price points** — the base ZAR amount
  plus the seller's `usdAmount`/`eurAmount` — and the client picks with
  `priceView()`. Prices are not secret (the paygate exists to show one), so
  there is nothing leaked by carrying the other two.
- **The charge is still server-derived and unchanged.** `startCheckout` takes
  the country and computes the amount itself; no client sends an amount. The
  quoted Rand and the charged Rand cannot diverge because `priceView` calls
  `chargeCents`, the same function the intent freezes from.
- Both readers now share one **`paywallValidator`** in `convex/lib.ts`, since
  a field reaching one paygate and not the other is a bug by construction.

### Three more deviations, all deliberate

1. **The country rides a context, not a prop chain.** Read once in the root
   layout (`headers()`, no middleware — ticket 20's first deviation stands),
   handed to `CountryProvider` beside `TenantProvider`. The two surfaces sit at
   different depths of two different trees — `Paygate` renders inside *both*
   readers — so threading a country prop to reach one price line would have
   touched every component in between for nothing.
2. **The `bankGuidance` note is hidden outside the base region too**, not just
   the EFT option. It names South African banks and PayFast's Instant EFT tile,
   and a US buyer reaches that branch *precisely because* EFT was withheld from
   them — advice about a rail they were never offered.
3. **No new error string for a bad regional price.** The existing
   `priceGreaterThanZero` covers all three fields; a fourth message saying the
   same thing in other words is not worth five translations.

### Two things the operator needs to know before this does anything

- **Nothing changes until a seller types the prices.** An Edition with no
  `usdAmount`/`eurAmount` sells at R100 everywhere, which is every Edition that
  exists today. The fields are in `SellEdition`, beside the Rand one.
- **It is invisible on localhost, and invisible to the operator in South
  Africa.** `x-vercel-ip-country` is absent in dev (base price) and reads `ZA`
  from Potchefstroom (base price) — so seeing the $10 view at all takes a
  deployed URL *and* a VPN. That is the accepted design (ticket 11 §5: no region
  picker, because one would hand every buyer the cheap price), not a gap, but it
  makes the walk below harder than the other four.

### The operator's walk is owed, same bar as 13, 14, 16 and 17

Nothing here was seen in a browser, and **this code is not on prod** — the two
commits above are unpushed, so ticket [18](18-operators-prod-walk.md)'s walk
does not currently cover it. Per the map's Rules a Rand figure that reads wrong
to the operator is a defect here, not a nitpick, and that judgement has not been
made yet.
