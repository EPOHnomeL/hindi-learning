// Pure derivations behind the donation widget (ADR 0027, marketplace/08). Sits
// beside checkoutDerive/welcomeDerive for the same reason they do: the widget's
// own seam, testable without React or a DOM.
//
// The donor types dollars and their card is charged Rand, so the parse is
// strict: at the money boundary an amount is either exactly what someone typed
// or it is rejected, never coerced.
//
// This file used to also convert to Rand and format it, for the widget's
// anti-surprise callout. That callout came off the page on 2026-08-02 (the
// operator's call — the ask was drowning in disclosures; the conversion is
// stated in the terms and the exact figure is on PayFast's own page), so the
// conversion went with it rather than lingering here unused. `zarCentsFromUsdCents`
// in convex/donations.ts is the live one, and always was the one that signs.

// The chips, in US cents. Presets are the decision recorded in ticket 03
// ($10 / $25 / $50 / custom); the floor lives server-side in `donations.config`
// and is checked against these by the unit tests.
export const DONATION_PRESETS_USD_CENTS = [1000, 2500, 5000] as const;

// A typed dollar amount → integer US cents, or null when it isn't one.
//
// **Never `parseFloat`.** `parseFloat("1e3")` is 1000 and `parseFloat("5abc")`
// is 5 — both are a charge the donor did not choose. A leading `$`, thousands
// commas and surrounding space are decoration and are forgiven; anything else
// is rejected outright and the widget says so.
export function parseUsdCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, "").trim();
  // Commas are only forgiven where a thousands separator belongs: "1,250" is an
  // amount, "5,5" is a typo (and a European decimal comma, which would silently
  // become $55 if the commas were simply stripped).
  if (!/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(cleaned) && !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = "", frac = ""] = cleaned.replace(/,/g, "").split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0") || "0");
}

// What the donor has asked to give: a preset chip's cents, or the custom field.
export type DonationSelection = number | "custom";

export type DonationAmount =
  | { ok: true; usdCents: number }
  // "empty" is not an error to shout about — it's the custom field waiting to be
  // filled. The widget disables the button and stays quiet; the other two speak.
  | { ok: false; reason: "empty" | "invalid" | "below-min" };

// The amount to charge, in US cents — a chip taken at face value, or the custom
// field parsed. `minUsdCents` comes from `donations.config`, so the floor the
// widget enforces is the same integer `checkoutFields` throws on; this copy of
// the check exists only so the donor is told before the click, not after it.
export function donationAmount({
  selection,
  custom,
  minUsdCents,
}: {
  selection: DonationSelection;
  custom: string;
  minUsdCents: number;
}): DonationAmount {
  let usdCents: number;
  if (selection === "custom") {
    if (!custom.trim()) return { ok: false, reason: "empty" };
    const parsed = parseUsdCents(custom);
    if (parsed === null) return { ok: false, reason: "invalid" };
    usdCents = parsed;
  } else {
    usdCents = selection;
  }
  if (usdCents < minUsdCents) return { ok: false, reason: "below-min" };
  return { ok: true, usdCents };
}

// US cents → "$25" / "$20.50". Whole dollars lose the ".00" — the chips are
// round numbers and "$10.00" on a chip reads like a price.
export function formatUsd(cents: number): string {
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return `$${whole}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
}
