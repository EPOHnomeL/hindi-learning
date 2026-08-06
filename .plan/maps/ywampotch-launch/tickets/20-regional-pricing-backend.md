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
