"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { Icon } from "./icons";
import { Dialog } from "./ui";

// The paygate (paid marketplace, ADR 0016 / PayFast rail). A caller reading a
// PAID Edition they don't hold gets the free Preview (the first Lesson); every
// other Lesson and Reference renders this in place of the content — an explicit
// locked state, never a blank pane. Checkout is auth-first (ADR 0021): the buy
// dialog shows the course + price and calls `market.startCheckout`, which
// derives the buyer from the signed-in account (no email input) and returns the
// signed PayFast field set to form-POST to PayFast's hosted checkout. Access is
// granted only by the verified ITN on PayFast's side, never by the return
// redirect itself.

export type Paywall = { amount: number; currency: string; previewKey: string | null };

// Minor units → a localised currency string (e.g. 120000 "zar" → "R 1 200,00").
// Assumes a 2-decimal currency (ZAR is); `Intl` renders the symbol and grouping
// for the viewer's locale.
export function formatPrice(amount: number, currency: string): string {
  const major = amount / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

// The locked-content pane both readers render for a Lesson/Reference past the
// free Preview: the item's title, then the paygate. The `<Paygate/>` is passed as
// children because its props differ slightly between the authed reader
// (ArtifactView) and the Guest reader (PublicReader) — the surrounding shell is
// what's shared, so it lives here in one place.
export function LockedPane({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col gap-1">
      <h2 className="truncate px-3 py-2 text-lg font-semibold md:px-0">{title}</h2>
      {children}
    </div>
  );
}

export function Paygate({
  paywall,
  kind,
  courseTitle,
  editionName,
  topicSlug,
  lang,
  buyHref,
  autoOpenBuy,
}: {
  paywall: Paywall | null;
  kind: "lesson" | "reference";
  courseTitle?: string;
  editionName?: string;
  // The Edition to buy (paid marketplace) — passed by both readers. When present,
  // the buy dialog can start checkout; absent, it degrades to an unavailable note.
  topicSlug?: string;
  lang?: string;
  // Share reader (auth-first, ADR 0021): the CTA is a LINK into the authed app
  // (the same content under /courses with a buy marker), never a dialog here —
  // checkout needs the signed-in account.
  buyHref?: string;
  // Authed reader: arriving with the buy marker opens the dialog immediately.
  autoOpenBuy?: boolean;
}) {
  const t = useTranslations("Checkout");
  const [buying, setBuying] = useState(!!autoOpenBuy && !buyHref);
  const price = paywall ? formatPrice(paywall.amount, paywall.currency) : null;
  const heading = kind === "reference" ? t("referenceLockedTitle") : t("courseLockedTitle");
  const ctaClass =
    "rounded-[10px] bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90";

  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md rounded-2xl border border-gold/40 bg-card p-6 shadow-sm sm:p-7">
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <Icon name="lock" />
        </span>
        <h3 className="text-lg font-semibold tracking-tight text-ink">{heading}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-soft">
          {t("unlockEditionBody", {
            edition: editionName ? t("namedEdition", { name: editionName }) : t("thisEdition"),
          })}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          {buyHref ? (
            <Link href={buyHref} className={ctaClass}>
              {t("unlockFullCourse")}
            </Link>
          ) : (
            <button onClick={() => setBuying(true)} className={ctaClass}>
              {t("unlockFullCourse")}
            </button>
          )}
          {price && <span className="text-2xl font-semibold tabular-nums text-ink">{price}</span>}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-soft">
          <Icon name="globe" className="h-3.5 w-3.5 text-accent2" />
          {t("payFastNote")}
        </p>
      </div>
      {buying && !buyHref && (
        <BuyDialog
          price={price}
          courseTitle={courseTitle}
          editionName={editionName}
          topicSlug={topicSlug}
          lang={lang}
          onClose={() => setBuying(false)}
        />
      )}
    </div>
  );
}

// The purchase summary → PayFast's hosted checkout. The buyer is the signed-in
// account (auth-first — checkout derives the email server-side), so this is
// just the course, the price, and one button: `market.startCheckout` returns
// the signed field set, auto-submitted as a form POST to the hosted process
// URL. On PayFast's side the verified ITN grants access — never the return
// redirect. Falls back to an "unavailable" note if the caller couldn't supply
// the Edition to buy.
function BuyDialog({
  price,
  courseTitle,
  editionName,
  topicSlug,
  lang,
  onClose,
}: {
  price: string | null;
  courseTitle?: string;
  editionName?: string;
  topicSlug?: string;
  lang?: string;
  onClose: () => void;
}) {
  const t = useTranslations("Checkout");
  const startCheckout = useMutation(api.market.startCheckout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canBuy = !!topicSlug && !!lang;

  const checkout = async () => {
    if (!canBuy) return;
    setBusy(true);
    setError(null);
    try {
      const { action, fields } = await startCheckout({ topicSlug: topicSlug!, lang: lang! });
      // POST the signed fields to PayFast's hosted checkout — a real form
      // submission (top-level navigation), built off-DOM and fired once. The
      // pairs are ordered: PayFast verifies the signature over the field order.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = action;
      for (const { name, value } of fields) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch {
      setError(t("checkoutFailed"));
      setBusy(false);
    }
  };

  return (
    <Dialog title={t("unlockThisCourse")} onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <b className="block text-[15px] text-ink">{courseTitle ?? t("thisCourse")}</b>
          <span className="text-xs text-soft">
            {t("editionLifetime", {
              edition: editionName ? t("editionName", { name: editionName }) : t("thisEditionTitle"),
            })}
          </span>
        </div>
        {price && (
          <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-bold tabular-nums text-gold">{price}</span>
        )}
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-hi/40 p-3.5 text-sm leading-relaxed text-soft">
        <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-accent2" />
        <span>{t("unlockDialogBody", { edition: editionName ?? t("thisLanguage") })}</span>
      </div>

      {/* Bank-to-method guidance — the last surface we own before PayFast's hosted
          picker, which is theirs to word. PayFast advertises 9 Instant EFT banks
          but renders only 5 on this account (Absa, Standard Bank, Capitec and
          African Bank are absent), so a buyer at one of those banks picks the
          tile that sounds right, finds no bank, and abandons. "Credit & Cheque
          card" is the answer for all of them, so that's all this says. Both tile
          names are quoted VERBATIM from PayFast's picker and stay English in every
          locale — a translated label is one the buyer can't find on screen.
          ponytail: hardcodes PayFast's CURRENT coverage. If they restore the four
          banks, delete this note and the `bankGuidance` key rather than editing it. */}
      <p className="mt-3 rounded-xl border border-gold/40 bg-gold/10 p-3 text-xs leading-relaxed text-soft">
        {t.rich("bankGuidance", { b: (c) => <b className="font-semibold text-ink">{c}</b> })}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void checkout();
        }}
      >
        <button
          type="submit"
          disabled={!canBuy || busy}
          className="mt-4 w-full rounded-[10px] bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? t("redirecting") : price ? `${t("continueToPayFast")} · ${price}` : t("continueToPayFast")}
        </button>
      </form>
      {error ? (
        <p className="mt-2.5 text-center text-xs text-danger">{error}</p>
      ) : (
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-xs text-soft">
          <Icon name="globe" className="h-3.5 w-3.5 text-accent2" /> {t("payFastNoteShort")}
        </p>
      )}
      {/* Point-of-sale compliance: the refund policy (all sales final) linked where the buyer commits. */}
      <p className="mt-1 text-center text-xs text-soft">
        {t.rich("purchaseAgreement", {
          terms: (c) => <Link href="/terms" className="text-accent2 underline-offset-2 hover:underline">{c}</Link>,
          refund: (c) => <Link href="/refunds" className="text-accent2 underline-offset-2 hover:underline">{c}</Link>,
        })}
      </p>
    </Dialog>
  );
}
