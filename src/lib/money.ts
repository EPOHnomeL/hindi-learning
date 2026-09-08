// **Money, as the product shows it.** One formatter, and the two conversions that
// go with it.
//
// Surfaced by the 2026-09-08 architecture walk. One R100 Edition printed three
// different ways: `R100` on its own poster (`poster.ts`'s `priceLabel`, narrow
// symbol, cents dropped when zero, symbol set tight against the figure),
// `R 100,00` in the admin cash log (`AdminPanel.tsx`'s `formatRand`, a hardcoded
// `R ` and a hardcoded `en-ZA`), and whatever the visitor's locale made of
// `style: "currency"` in the paygate (`Paygate.tsx`'s `formatPrice`). The
// minor-to-major conversion was open-coded three more times on top of that.
//
// **Two decimal places, everywhere.** The operator's call on 2026-09-08, chosen
// over keeping two named styles and over the poster's compact spelling. It is
// unambiguous and it keeps a column of figures scannable, and the price of it is
// stated rather than hidden: a course poster now prints `R 100,00` where it used
// to print `R100`, which is a deliberate visual change to a surface that had
// already been signed off.
//
// This is DISPLAY. The wire format a payment gateway wants is a different thing
// with different rules and it lives with the gateway, in
// `convex/payfast.ts`'s `payfastAmountField`.

// Cents to major units. The division that was written out at four call sites.
export function toMajor(cents: number): number {
  return cents / 100;
}

// Major units back to cents, for a price form's input. Rounds, because a form
// hands back a string a human typed and `19.99 * 100` is `1998.9999999999998` in
// binary floating point, which would price the Edition a cent light.
export function fromMajor(major: string | number): number {
  return Math.round(Number(major) * 100);
}

// Cents to the string a human reads: the currency's narrow symbol, its locale's
// grouping, and always two decimal places.
//
// `locale` omitted means the viewer's own locale, which is what a paygate wants.
// The poster and the admin log pass one, because a rendered poster and a cash log
// must not read differently depending on who opened them.
//
// Falls back to a plain "100.00 ZAR" for a currency `Intl` rejects, rather than
// throwing on a price the seller has already been shown.
export function formatMoney(cents: number, currency: string, opts?: { locale?: string }): string {
  const major = toMajor(cents);
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(opts?.locale, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${code}`;
  }
}
