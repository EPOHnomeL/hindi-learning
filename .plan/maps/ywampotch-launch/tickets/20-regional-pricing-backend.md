---
type: task
blocked_by: [11]
---

> `/wayfinder .plan/maps/ywampotch-launch/tickets/20-regional-pricing-backend.md`

# Build regional pricing — schema, region resolution, and the two intent freezes

## Question

**Read [ticket 11's Answer](11-regional-pricing-mechanism.md) first — it is the
spec, and a detail not written there was not decided.** This is the backend half:
everything below `convex/` plus the middleware header, with no buyer-visible
change yet (that is [21](21-regional-pricing-surfaces.md)).

The work:

- **Schema.** `listings` grows `usdAmount` and `eurAmount`, both
  `v.optional(v.number())`, in the **foreign currency's minor units** (US cents,
  euro cents) — not ZAR. Absent means that region falls back to the base ZAR
  `amount`, so every existing listing keeps working with no backfill.
- **The rate module.** One committed constant per currency, USD→ZAR and EUR→ZAR,
  in one place the whole repo imports. **Check whether
  [marketplace/07](../../marketplace/tickets/07-build-donation-rail-backend.md)
  has already landed its USD constant** — if so, extend that module rather than
  minting a second source of truth; if not, create it here and leave a pointer so
  07 imports it.
- **Region resolution.** A pure `regionForCountry(code)` → `"us" | "eu" | "base"`.
  `"eu"` is the 27 member states **plus GB, CH, NO, IS** (ticket 11 §5). Unknown
  or absent code → `"base"`.
- **The price chokepoint.** A pure function from `(listing, region)` to the ZAR
  charge in cents: `us` → `round(usdAmount × USD_ZAR)`, `eu` → likewise with
  EUR, either falling back to `listing.amount` when the field is absent. Both
  rails already freeze from `editionPrice()` at
  [market.ts:407](../../../../convex/market.ts) and
  [eft.ts:166](../../../../convex/eft.ts) — route both through this.
- **`market.setEditionPrice`** accepts the two optional foreign amounts, with the
  same bounded-positive-integer validation the ZAR `amount` already gets. The
  ZAR-only currency check **stays** — `currency` still describes the base price.
- **`market.startCheckout`** takes a `country` argument and computes the frozen
  amount server-side. **The client never sends an amount.**
- **`eft.startEftPurchase`** takes `country` and **throws outside ZA**
  (ticket 11 §6). The UI hiding it is not the gate.
- **`src/middleware.ts`** forwards `x-vercel-ip-country` onto the request headers
  for server components to read, alongside the existing `x-tenant-slug` / `x-url`
  stamps. Never trust an inbound value — delete it first, exactly as the tenant
  slug is handled.

`tdd` then `ponytail`, per the map's Rules. Tests seed only states production can
produce. **Never touch `convex/payfast.ts`** — the ITN amount match is unchanged
by design and it holds real money.

## Done when

Schema, rate module, `regionForCountry`, the price chokepoint, both mutations and
the middleware header are in, with tests covering: absent regional fields falling
back to base; `us`/`eu` computing the frozen ZAR amount; an unknown and an absent
country both resolving to `base`; and `startEftPurchase` rejecting a non-ZA
country. `pnpm typecheck` and `pnpm test` green (bar the known `sales.test.ts`
flake). `git diff convex/payfast.ts` empty.

## Answer

Built 2026-08-06, `tdd` then `ponytail`. 13 new tests in
`convex/regionalPricing.test.ts`; **813/813 green** (the `sales.test.ts` flake
passed this run too), and `git diff convex/payfast.ts` is **empty** — the rail
holding real money was not touched.

**The whole feature is two pure functions and one extra argument.** No new
table, no index, no migration, no backfill.

- **`convex/rates.ts`** (new) — `USD_ZAR_RATE` (18.4, unchanged) and
  `EUR_ZAR_RATE` (19.8), plus a conversion helper each. **The donation rail had
  already landed** since this ticket was written (ADR 0027, `convex/donations.ts`
  is live), so its `USD_ZAR_RATE` was **moved here and re-exported** from
  `donations.ts` rather than duplicated. That is the shared constant ticket 11
  demanded, and it now genuinely exists: one number per currency in the repo.
  Extracted to its own module rather than importing `donations.ts` from
  `market.ts`, which would couple two unrelated rails.
- **`convex/regions.ts`** (new) — `regionForCountry` and `chargeCents`, both
  pure and both trivially testable, plus `eftAllowed`.
- **`listings`** gained `usdAmount` / `eurAmount`, optional, foreign minor units.
- **`setEditionPrice`** takes them, bounded by the same rule as the ZAR amount
  (factored into one `bounded()` helper rather than three copies). They are
  written on **every** save including as `undefined`, so omitting a field
  *clears* that regional price — otherwise a price could be set but never
  withdrawn, which the tests pin.
- **`startCheckout`** and **`startEftPurchase`** take an optional `country`.

### Two deviations from this ticket as written

1. **No middleware change, and the ticket was wrong to ask for one.**
   `x-vercel-ip-country` is **already on the incoming request** and Vercel
   overwrites it at the edge, so a server component reads it straight from
   `headers()`. The tenant slug needs stamping because it's *derived* from Host,
   and `x-url` because server components can't see the URL — neither applies
   here. The ticket's "never trust an inbound value" instruction was cargo-culted
   from the tenant slug: the delete-and-restamp would have been a literal no-op
   in prod and pure ceremony. **A comment stands in `src/middleware.ts`** saying
   so, so the next session doesn't re-add it.
2. **The EFT gate is `region !== "base"`, not `country !== "ZA"`.** Same
   arbitrage closed, and strictly better: it is defined in terms of the thing
   that actually matters (are they paying the base price?), so it can't drift
   from the pricing rule, and a **no-header caller still gets through** — which
   matters because localhost sends no country and the operator has an owed dev
   walk of this exact rail.

### For ticket 21

- The country reaches Convex as an **argument**; nothing else about the client
  contract changes. **Never pass an amount** — the server derives it, and the
  tests assert the frozen intent equals the server's own computation.
- `chargeCents` is exported and pure: the surfaces should call it for the
  anti-surprise line rather than doing their own second conversion, so the
  quoted Rand is provably the charged Rand.
- `EUR_ZAR_RATE = 19.8` is a guess in the same spirit as the donation rail's
  18.4 — deliberately **under** the market rate so the Rand never exceeds a
  buyer's mental conversion. Worth the operator's eye before go-live.
