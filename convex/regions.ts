import { zarCentsFromEurCents, zarCentsFromUsdCents } from "./rates";

// **Regional pricing** (ywampotch-launch ticket 11) — which price a buyer sees,
// and the one place a ZAR charge is derived from a foreign price point.
//
// The ask is $10 from the US, €10 from Western Europe, R100 everywhere else.
// R100 is about $5.50, so those are DELIBERATELY higher prices, not the same
// money relabelled — this is price discrimination, and the operator confirmed
// that is the intent. The charge is always ZAR on the existing PayFast rail
// (ADR 0026 stands); the foreign figure is presentment, disclosed beside the
// Rand it converts to.
//
// Everything here is PURE. The country comes from `x-vercel-ip-country`, read
// in `src/middleware.ts` and passed to Convex as an explicit argument — Convex
// runs off Vercel and can never see the header itself (ticket 10).

export type PriceRegion = "us" | "eu" | "base";

// "EU" is **Western Europe by intent, not the 27 by letter** (ticket 11 §5):
// the 27 member states plus the UK, Switzerland, Norway and Iceland, all quoted
// in euros. A UK buyer is exactly the wealthy-market buyer the euro price is
// aimed at, and letting them through at R100 would be an accident, not a
// decision. A separate £ price point was offered to the operator and declined.
const EU_COUNTRIES = new Set([
  // The 27.
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR",
  "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
  "SE", "SI", "SK",
  // Western Europe outside the union.
  "GB", "CH", "NO", "IS",
]);

// The buyer's price region. **Anything we don't recognise is `base`** — the
// cheapest price — and that direction is deliberate: the header is absent on
// localhost, absent for some bots, and defeated by any VPN, so the failure mode
// has to be lost margin rather than an overcharge we'd have to defend.
//
// A US buyer on a Johannesburg VPN pays R100. Named and accepted by ticket 11;
// there is deliberately no region picker, since offering one would hand every
// buyer a legitimate route to the cheapest price.
export function regionForCountry(code: string | null | undefined): PriceRegion {
  const c = (code ?? "").trim().toUpperCase();
  if (c === "US") return "us";
  if (EU_COUNTRIES.has(c)) return "eu";
  return "base";
}

// The ZAR cents to charge — **the single chokepoint both rails freeze from**.
//
// `listing.amount` is the base ZAR price; `usdAmount`/`eurAmount` are optional
// and in the FOREIGN currency's minor units. The foreign side is what the
// seller typed and what the buyer is shown, so it is the exact one; the Rand
// derives. An unset regional amount falls back to the base price, which is what
// lets every listing that already exists keep working with no backfill.
export function chargeCents(
  listing: { amount: number; usdAmount?: number; eurAmount?: number },
  region: PriceRegion,
): number {
  if (region === "us" && listing.usdAmount !== undefined) return zarCentsFromUsdCents(listing.usdAmount);
  if (region === "eu" && listing.eurAmount !== undefined) return zarCentsFromEurCents(listing.eurAmount);
  return listing.amount;
}

// Is this buyer paying the base price? **The EFT gate** (ticket 11 §6).
//
// EFT is a South African bank rail, and leaving it open at the base price to a
// buyer quoted $10 by card would hand them a 45% discount for clicking the
// other button. Phrased as "is the region base" rather than "is the country ZA"
// so it closes the arbitrage by construction and still lets a no-header caller
// through — localhost sends no country, and the operator walking the rail in
// dev must not be locked out of it.
export function eftAllowed(region: PriceRegion): boolean {
  return region === "base";
}
