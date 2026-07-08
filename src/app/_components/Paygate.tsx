"use client";

import { useAction } from "convex/react";
import { useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { Icon } from "./icons";
import { Dialog } from "./ui";

// The paygate (paid marketplace, ADR 0016). A caller reading a PAID Edition they
// don't hold gets the free Preview (the first Lesson); every other Lesson and
// Reference renders this in place of the content — an explicit locked state, never
// a blank pane. The buy dialog opens Stripe Checkout (Slice 3): its final step
// calls `market.startCheckout` and redirects to Stripe. Access is granted only by
// the verified webhook on return, never by the redirect itself.

export type Paywall = { amount: number; currency: string; previewKey: string | null };

// Minor units → a localised currency string (e.g. 1200 "usd" → "$12.00"). Assumes
// a 2-decimal currency (every currency this ships with); `Intl` renders the symbol
// and grouping for the viewer's locale.
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
}: {
  paywall: Paywall | null;
  kind: "lesson" | "reference";
  courseTitle?: string;
  editionName?: string;
  // The Edition to buy (paid marketplace) — passed by both readers. When present,
  // the buy dialog can start checkout; absent, it degrades to an unavailable note.
  topicSlug?: string;
  lang?: string;
}) {
  const [buying, setBuying] = useState(false);
  const price = paywall ? formatPrice(paywall.amount, paywall.currency) : null;
  const heading =
    kind === "reference" ? "This reference is part of the full course" : "The rest of this course is locked";

  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md rounded-2xl border border-gold/40 bg-card p-6 shadow-sm sm:p-7">
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <Icon name="lock" />
        </span>
        <h3 className="text-lg font-semibold tracking-tight text-ink">{heading}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-soft">
          You’ve read the free first lesson. Unlock every lesson and reference — lifetime access to
          {editionName ? ` the ${editionName} edition` : " this edition"}, in a single payment.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            onClick={() => setBuying(true)}
            className="rounded-[10px] bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
          >
            Unlock the full course
          </button>
          {price && <span className="text-2xl font-semibold tabular-nums text-ink">{price}</span>}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-soft">
          <Icon name="globe" className="h-3.5 w-3.5 text-accent2" />
          Shown in your local currency · pay once, keep forever
        </p>
      </div>
      {buying && (
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

// The purchase summary → Stripe Checkout (Slice 3). "Continue to checkout" calls
// `market.startCheckout` (a direct charge on the Seller's connected account with
// the platform fee) and redirects to Stripe's hosted page; on return, the
// signature-verified webhook grants access — never this redirect. Falls back to
// an "unavailable" note if the caller couldn't supply the Edition to buy.
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
  const startCheckout = useAction(api.market.startCheckout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canBuy = !!topicSlug && !!lang;

  const checkout = async () => {
    if (!canBuy) return;
    setBusy(true);
    setError(null);
    try {
      const returnPath =
        typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined;
      const { url } = await startCheckout({ topicSlug: topicSlug!, lang: lang!, returnPath });
      window.location.href = url;
    } catch {
      setError("Couldn’t start checkout — please try again in a moment.");
      setBusy(false);
    }
  };

  return (
    <Dialog title="Unlock this course" onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <b className="block text-[15px] text-ink">{courseTitle ?? "This course"}</b>
          <span className="text-xs text-soft">{editionName ? `${editionName} edition` : "This edition"} · lifetime access</span>
        </div>
        {price && (
          <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-bold tabular-nums text-gold">{price}</span>
        )}
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-hi/40 p-3.5 text-sm leading-relaxed text-soft">
        <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-accent2" />
        <span>
          You’ve read the free first lesson. This unlocks every remaining lesson and reference — yours for good, in
          {editionName ? ` ${editionName}` : " this language"}.
        </span>
      </div>

      <button
        disabled={!canBuy || busy}
        onClick={() => void checkout()}
        className="mt-4 w-full rounded-[10px] bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? "Redirecting to checkout…" : `Continue to checkout${price ? ` · ${price}` : ""}`}
      </button>
      {error ? (
        <p className="mt-2.5 text-center text-xs text-danger">{error}</p>
      ) : (
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-xs text-soft">
          <Icon name="globe" className="h-3.5 w-3.5 text-accent2" /> Shown in your local currency · pay once, keep forever
        </p>
      )}
      <p className="mt-1 text-center text-xs text-soft">No account? Buying will create one for you.</p>
    </Dialog>
  );
}
