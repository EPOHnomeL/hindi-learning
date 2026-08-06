import { chargeCents, regionForCountry } from "../../../convex/regions";
import type { Paywall } from "./Paygate";

// What the buyer is SHOWN (ywampotch-launch/21) — the visible half of regional
// pricing, whose backend is ticket 20.
//
// The seam exists so one rule answers both money surfaces (the Paygate card and
// the checkout page) rather than each doing its own arithmetic, and so the
// arithmetic is testable without a DOM. It imports `convex/regions` deliberately:
// the Rand quoted here is `chargeCents`, the very function `startCheckout` freezes
// onto the intent, so the anti-surprise line cannot drift from the charge. A
// second conversion living over here would be exactly the surprise it prevents.
export type PriceView = {
  // What to show, in the buyer's own currency's minor units — $10.00 for a US
  // buyer, R100.00 for everyone else.
  amount: number;
  currency: string;
  // The Rand that will actually hit the card, when it differs from the figure
  // above. **Null for a base-region buyer**: they are quoted Rand and charged
  // Rand, so there is no conversion to disclose and the line would be noise.
  chargedZarCents: number | null;
};

export function priceView(paywall: Paywall | null | undefined, country: string | null | undefined): PriceView | null {
  if (!paywall) return null;
  const region = regionForCountry(country);
  const foreign =
    region === "us" && paywall.usdAmount !== undefined
      ? { amount: paywall.usdAmount, currency: "usd" }
      : region === "eu" && paywall.eurAmount !== undefined
        ? { amount: paywall.eurAmount, currency: "eur" }
        : null;
  // No regional price set for this region — the seller sells there at the base
  // Rand price, which is also what a VPN, a bot and localhost all land on.
  if (!foreign) return { amount: paywall.amount, currency: paywall.currency, chargedZarCents: null };
  return { ...foreign, chargedZarCents: chargeCents(paywall, region) };
}
