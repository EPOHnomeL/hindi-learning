import { describe, expect, it } from "vitest";
import { priceView } from "./priceDerive";

// The buyer-visible half of regional pricing (ywampotch-launch/21). What a buyer
// is SHOWN must be what the server will charge, so these cases mirror
// `convex/regionalPricing.test.ts` — the same listing, the same countries, the
// same Rand out the other end.

const base = { amount: 10_000, currency: "zar", previewKey: "0001" };
const regional = { ...base, usdAmount: 1000, eurAmount: 1000 }; // $10.00 / €10.00

describe("priceView", () => {
  it("is null for a free edition", () => {
    expect(priceView(null, "US")).toBeNull();
  });

  it("shows the base Rand price with NO charged-as line at home", () => {
    // There is no conversion to disclose, so the anti-surprise line would be
    // noise — "R100.00 — charged as R100.00" reads as a system talking to itself.
    expect(priceView(regional, "ZA")).toEqual({ amount: 10_000, currency: "zar", chargedZarCents: null });
  });

  it("shows dollars to a US buyer, with the Rand actually charged", () => {
    expect(priceView(regional, "US")).toEqual({ amount: 1000, currency: "usd", chargedZarCents: 18_400 });
  });

  it("shows euros across Western Europe, including the non-EU four", () => {
    for (const country of ["DE", "FR", "GB", "CH", "NO", "IS"]) {
      expect(priceView(regional, country)).toEqual({ amount: 1000, currency: "eur", chargedZarCents: 19_800 });
    }
  });

  it("falls back to the base price when the region has no price set", () => {
    // A seller who priced only dollars still sells to Europe — at R100.
    expect(priceView({ ...base, usdAmount: 1000 }, "DE")).toEqual({
      amount: 10_000,
      currency: "zar",
      chargedZarCents: null,
    });
  });

  it("falls back to the base price with no country at all — localhost, a bot", () => {
    for (const country of [null, undefined, "", "  "]) {
      expect(priceView(regional, country)).toEqual({ amount: 10_000, currency: "zar", chargedZarCents: null });
    }
  });

  it("quotes the Rand the server will freeze, never its own conversion", () => {
    // The guarantee behind the anti-surprise line: this number is `chargeCents`,
    // not a second conversion that could drift from it.
    for (const usdAmount of [1, 7, 333, 999, 1234]) {
      const view = priceView({ ...base, usdAmount }, "US");
      expect(view).toEqual({ amount: usdAmount, currency: "usd", chargedZarCents: Math.round(usdAmount * 18.4) });
    }
  });
});
