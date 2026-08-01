// Pure derivations behind the donation widget (ADR 0027, marketplace/08). Sits
// beside checkoutDerive/welcomeDerive for the same reason they do: the widget's
// own seam, testable without React or a DOM.
//
// Everything here is about ONE hazard — the donor types dollars and their card
// is charged Rand, and with a donor-chosen amount *both* numbers are live. So
// the parse is strict, the conversion is the server's own rule, and the Rand
// figure is formatted identically in every locale.

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
  | { ok: true; usdCents: number; zarCents: number }
  // "empty" is not an error to shout about — it's the custom field waiting to be
  // filled. The widget disables the button and stays quiet; the other two speak.
  | { ok: false; reason: "empty" | "invalid" | "below-min" };

// The amount to charge, and the Rand it becomes.
//
// The conversion mirrors `zarCentsFromUsdCents` in convex/donations.ts —
// deliberately, because the anti-surprise line has to quote the figure BEFORE
// the signed fields are fetched, and quoting a second, different conversion of
// the same dollars would be the exact surprise it exists to prevent. The rate is
// passed in from `donations.config`, so both sides read the one committed
// constant and can only agree.
export function donationAmount({
  selection,
  custom,
  minUsdCents,
  usdZarRate,
}: {
  selection: DonationSelection;
  custom: string;
  minUsdCents: number;
  usdZarRate: number;
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
  return { ok: true, usdCents, zarCents: Math.round(usdCents * usdZarRate) };
}

// ZAR cents → "R18 400.00". Hand-formatted rather than `Intl.NumberFormat`
// because this is the number the card is charged: it must read the same for a
// donor whose browser is in `hi-IN` (which would group it 18,400 the Indian way)
// as for one in `en-ZA`, and it must not silently become "ZAR 18,400.00" when a
// runtime lacks the locale data.
export function formatZar(cents: number): string {
  const whole = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `R${whole}.${String(cents % 100).padStart(2, "0")}`;
}

// US cents → "$25" / "$20.50". Whole dollars lose the ".00" — the chips are
// round numbers and "$10.00" on a chip reads like a price.
export function formatUsd(cents: number): string {
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return `$${whole}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
}
