// **The committed foreign-exchange rates** — the only bridge between a price
// quoted in a foreign currency and the Rand PayFast actually charges.
//
// Two rails need them and must never disagree: the donation rail (ADR 0027 — a
// Guest types dollars) and regional pricing (ywampotch-launch ticket 11 — a
// seller types $10/€10 per Edition). They live here rather than in either rail
// so neither imports the other, and so there is exactly ONE number per currency
// in the repo. Ticket 11 calls this out by name: with one conversion and one
// constant, no transaction can ever have two different dollar figures on it.
//
// Committed constants, changed by deploy. They WILL go stale if nobody watches
// them — that cost was accepted knowingly by both tickets; the follow-up is
// marketplace ticket 05, Live USD→ZAR rate.
//
// Both err slightly UNDER the market rate, so the Rand charge never exceeds
// what a buyer's own mental conversion of the foreign figure would suggest.
// Erring the other way is the surprise the anti-surprise line exists to prevent.

export const USD_ZAR_RATE = 18.4;
export const EUR_ZAR_RATE = 19.8;

// Foreign minor units → the ZAR cents PayFast is asked to charge. Integer math
// at the money boundary: the rounding is the last float in the chain and lands
// on a whole cent, because a fractional cent reaching PayFast is a signature
// mismatch rather than a rounding nit.
//
// Exported because the buyer-facing surfaces must quote the number actually
// charged, not run their own second conversion of the same foreign amount.
export function zarCentsFromUsdCents(usdCents: number): number {
  return Math.round(usdCents * USD_ZAR_RATE);
}

export function zarCentsFromEurCents(eurCents: number): number {
  return Math.round(eurCents * EUR_ZAR_RATE);
}
