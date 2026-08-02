"use client";

import { useConvex, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { DONATION_PRESETS_USD_CENTS, donationAmount, formatUsd, type DonationSelection } from "./donateDerive";
import { Icon } from "./icons";
import { postToPayFast } from "./payfastPost";
import { useTenant, useTenantSlug } from "./TenantContext";

// The donation widget (ADR 0027, marketplace/08) — `<section id="donations">`,
// rendered in TWO places since 2026-08-02 (marketplace/10):
//   - on a tenant's landing page, where it is the passive ask for anyone
//     scrolling past (automatically on <Landing/>, by hand on YwamPotch.tsx);
//   - alone on `/donate`, which is the surface a shared donation LINK points at.
//
// **The anchor used to be the only way in, and that was the bug.** 08 shipped on
// the assumption that `<tenant>.my-course.app#donations` was sufficient, but this
// component returns null until its queries resolve — so the browser found no
// anchor to scroll to — and signed in, `/` is the Dashboard, which has no section
// at all. /donate has neither problem. The anchor still works (see the scroll
// effect below); it is no longer load-bearing.
//
// Renders nothing unless this tenant's `donations` flag is on. The flag is
// fail-closed by absence (schema.ts), so the default site and every unflagged
// tenant get no section at all — and the server refuses the same states again
// in `donations.checkoutFields`, so this gate is convenience, never security.
//
// The donor is a Guest: no account, no email field, nothing persisted until the
// verified ITN. One server call, a QUERY, made on the click.
export function DonateSection() {
  const t = useTranslations("Donate");
  const slug = useTenantSlug();
  const tenant = useTenant();
  const convex = useConvex();
  // The floor, the rate and the platform's cut, from the one place they are
  // defined (convex/donations.ts) — so this copy cannot drift from the constants
  // the server actually signs with.
  const config = useQuery(api.donations.config);

  const [selection, setSelection] = useState<DonationSelection>(DONATION_PRESETS_USD_CENTS[1]);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // The return page. 03 chose no intent table, so there is nothing to look up
  // and the thank-you is necessarily generic — it acknowledges, it never claims
  // a payment we haven't seen. Read off `window` in an effect rather than via
  // `useSearchParams` so this component can't drag the landing page's rendering
  // mode around; mount-gated, so it cannot mismatch hydration either.
  const [thanks, setThanks] = useState(false);
  useEffect(() => {
    setThanks(new URLSearchParams(window.location.search).get("donation") === "thanks");
  }, []);

  // Whether this component is about to render anything at all — the same
  // condition as the early return below, hoisted so the scroll effect can depend
  // on it (hooks must run before any return).
  const ready = Boolean(slug && tenant?.flags.donations && config);

  // **The `#donations` scroll fix** (marketplace/11). The anchor id was always
  // correct; the section simply wasn't in the document when the browser acted on
  // the hash, because this component returns null until the tenant flags and
  // `donations.config` resolve — and nothing retries a failed hash scroll. So do
  // it ourselves, keyed on `ready` rather than on mount: the mount effect above
  // fires while we are still returning null, which is exactly the trap that made
  // the original anchor look broken. Legacy links are why this is worth keeping
  // now that /donate exists — `<tenant>.my-course.app#donations` is already out
  // in WhatsApp messages and email footers.
  useEffect(() => {
    if (!ready) return;
    if (window.location.hash !== "#donations") return;
    document.getElementById("donations")?.scrollIntoView();
  }, [ready]);

  if (!ready || !slug || !tenant || !config) return null;

  const name = tenant.displayName;
  const amount = donationAmount({ selection, custom, minUsdCents: config.minUsdCents });
  // "empty" is the custom field waiting to be filled — the button is simply
  // disabled. The other two reasons are things the donor needs told.
  const error = !amount.ok && amount.reason !== "empty" ? amount.reason : null;

  const donate = async () => {
    if (!amount.ok) return;
    setBusy(true);
    setFailed(false);
    try {
      const { action, fields } = await convex.query(api.donations.checkoutFields, {
        tenantSlug: slug,
        usdCents: amount.usdCents,
      });
      postToPayFast(action, fields);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  const chipClass = (active: boolean) =>
    `rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors ${
      active ? "border-gold bg-gold/15 text-accent" : "border-line bg-card text-ink hover:border-gold hover:text-accent"
    }`;

  return (
    <section id="donations" className="scroll-mt-8 border-y border-line bg-card/60">
      <div className="mx-auto w-full max-w-2xl px-6 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {t("heading", { name })}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center leading-relaxed text-soft">{t("body", { name })}</p>

        {/* **The thank-you REPLACES the widget, it doesn't sit above it.** On the
            landing page this was a callout partway down a long page and the
            widget below it was invisible in practice; on /donate it isn't, and
            re-asking someone who has just paid reads as a broken page or a
            double-charge risk. Ticket 03 chose no intent table, so
            `?donation=thanks` is the ONLY signal separating a returning donor
            from a fresh visitor — which means it has to change what the page is,
            not just decorate it. The header's brand link is the way onward. */}
        {thanks ? (
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-accent2/40 bg-accent2/10 p-4">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-accent2" />
            <span className="text-sm leading-relaxed text-soft">
              <b className="block text-ink">{t("thanksHeading")}</b>
              {t("thanksBody")}
            </span>
          </div>
        ) : (
          <>
            <fieldset disabled={busy} className="mt-8 min-w-0">
              <legend className="text-sm font-semibold text-ink">{t("amountLabel")}</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {DONATION_PRESETS_USD_CENTS.map((cents) => (
                  <button
                    key={cents}
                    type="button"
                    aria-pressed={selection === cents}
                    onClick={() => setSelection(cents)}
                    className={chipClass(selection === cents)}
                  >
                    {formatUsd(cents)}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={selection === "custom"}
                  onClick={() => setSelection("custom")}
                  className={chipClass(selection === "custom")}
                >
                  {t("other")}
                </button>
              </div>

              {selection === "custom" && (
                <label className="mt-3 block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-accent2">{t("customLabel")}</span>
                  <input
                    // `inputMode="decimal"` and not `type="number"`: the parse is
                    // strict and locale-independent (donateDerive), and a number
                    // input hands us a browser-localised value plus spinners nobody
                    // wants on a donation.
                    inputMode="decimal"
                    autoComplete="off"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder={t("customPlaceholder")}
                    aria-label={t("customLabel")}
                    className="mt-1 w-full rounded-[10px] border border-line bg-card px-3 py-2.5 text-[15px] text-ink outline-none focus:border-gold"
                  />
                </label>
              )}

              {error && (
                <p className="mt-2.5 text-sm text-danger">
                  {error === "below-min" ? t("errorMinimum", { min: formatUsd(config.minUsdCents) }) : t("errorInvalid")}
                </p>
              )}

              <button
                type="button"
                onClick={() => void donate()}
                disabled={!amount.ok || busy}
                className="mt-4 w-full rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy
                  ? t("redirecting")
                  : amount.ok
                    ? t("donateAmount", { amount: formatUsd(amount.usdCents) })
                    : t("donate")}
              </button>
            </fieldset>

            {failed && <p className="mt-2.5 text-center text-sm text-danger">{t("failed")}</p>}

            {/* One line, and it carries everything the disclosures used to.
            **This section used to state three more things**: the exact rand
            amount the card would be charged (03's anti-surprise line, in its own
            callout), the platform's 10%, and that this is not a tax-deductible
            receipt. All three came off on the operator's instruction (2026-08-02)
            after seeing the live page — a donation ask that opens with a fee
            disclosure and a tax disclaimer reads as terms and conditions, and the
            widget's job is to take donations. They are not gone, they MOVED: the
            terms page now has a Donations clause covering the rand conversion,
            the operator's cut and the receipt position, and this line links to
            it. If you are about to re-add prose here, add it there instead. */}
            <p className="mt-4 text-center text-xs leading-relaxed text-soft">
              {t.rich("agreement", {
                terms: (c) => (
                  <Link href="/terms" className="text-accent2 underline-offset-2 hover:underline">
                    {c}
                  </Link>
                ),
              })}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
