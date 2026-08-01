"use client";

import { useConvex, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import {
  DONATION_PRESETS_USD_CENTS,
  donationAmount,
  formatUsd,
  formatZar,
  type DonationSelection,
} from "./donateDerive";
import { Icon } from "./icons";
import { postToPayFast } from "./payfastPost";
import { useTenant, useTenantSlug } from "./TenantContext";

// The donation widget (ADR 0027, marketplace/08) — `<section id="donations">` on
// a tenant's landing page, because the anchor IS the requirement: the operator
// shares `<tenant>.my-course.app#donations` and expects to land here.
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

  if (!slug || !tenant?.flags.donations || !config) return null;

  const name = tenant.displayName;
  const amount = donationAmount({
    selection,
    custom,
    minUsdCents: config.minUsdCents,
    usdZarRate: config.usdZarRate,
  });
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

        {thanks && (
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-accent2/40 bg-accent2/10 p-4">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-accent2" />
            <span className="text-sm leading-relaxed text-soft">
              <b className="block text-ink">{t("thanksHeading")}</b>
              {t("thanksBody")}
            </span>
          </div>
        )}

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

          {/* The anti-surprise line, and it is load-bearing rather than polish:
              the donor types dollars and their card is charged Rand, and with a
              donor-chosen amount BOTH numbers are live. So the Rand figure sits
              directly above the button, in its own callout, quoting the exact
              amount the signed fields will carry. */}
          {amount.ok && (
            <p className="mt-4 rounded-xl border border-gold/40 bg-gold/10 p-3.5 text-sm leading-relaxed text-soft">
              {t.rich("charge", {
                zar: formatZar(amount.zarCents),
                b: (c) => <b className="font-semibold text-ink">{c}</b>,
              })}
            </p>
          )}

          <button
            type="button"
            onClick={() => void donate()}
            disabled={!amount.ok || busy}
            className="mt-4 w-full rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? t("redirecting") : amount.ok ? t("donateAmount", { zar: formatZar(amount.zarCents) }) : t("donate")}
          </button>
        </fieldset>

        {failed && <p className="mt-2.5 text-center text-sm text-danger">{t("failed")}</p>}

        {/* What the donor is owed in plain words before they commit: where the
            money goes, and that this is not a Section 18A receipt (ADR 0027 —
            the operator is merchant of record, so the tenant cannot issue one). */}
        <p className="mt-4 text-center text-xs leading-relaxed text-soft">
          {t("feeNote", { percent: config.feeBps / 100, name })}
        </p>
        <p className="mt-1.5 text-center text-xs leading-relaxed text-soft">{t("notReceipt")}</p>
      </div>
    </section>
  );
}
