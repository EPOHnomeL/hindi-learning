"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { type CheckoutStep } from "./checkoutDerive";
import { Icon } from "./icons";

// The paygate (paid marketplace, ADR 0016 / PayFast rail). A caller reading a
// PAID Edition they don't hold gets the free Preview (the first Lesson); every
// other Lesson and Reference renders this in place of the content — an explicit
// locked state, never a blank pane. Checkout is auth-first (ADR 0021), and it is
// a PAGE (`/checkout/<slug>/<lang>`, CheckoutPage.tsx), not a dialog — so
// everything here does is name the price and link to it. One CTA, one target,
// signed in or out: signed out the link lands on `SignIn` at that same URL.

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

// The whole purchase on one line, at the top of every step of it: Account →
// Method → Pay → Course. The funnel is four screens across two components
// (SignIn, then BuyDialog's chooser and method panel) and a buyer part-way
// through has no other way to tell how much is left — the diagnosed abandonment
// is people who can't see the end. Steps behind the current one are ticked, the
// current one is bold, the rest are quiet; nothing is clickable, because you
// can't skip a step or undo a payment.
//
// The labels are ONE WORD each, and that is load-bearing rather than terse for
// its own sake: this renders in a 384px sign-in card, and the sentence-length
// labels it started with ("Choose payment method", "Continue to your course")
// wrapped onto a second line and read as broken — in French and Hindi they are
// longer still. Four short labels plus their markers measure ~275px, so the row
// holds one line in every locale. `whitespace-nowrap` makes a regression here
// overflow visibly instead of silently re-wrapping.
export function CheckoutSteps({ current }: { current: CheckoutStep }) {
  const t = useTranslations("Checkout");
  const steps = [t("stepAccount"), t("stepMethod"), t("stepPay"), t("stepCourse")];
  return (
    <ol className="flex items-center justify-center gap-1 text-[11px] leading-none">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-1">
            {/* A hairline instead of a chevron: at this size a "›" glyph sat on
                a different baseline to the markers and read as punctuation
                inside the label rather than a separator between steps. */}
            {i > 0 && <span aria-hidden className="mr-1 h-px w-2.5 bg-line" />}
            <span
              className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                done
                  ? "bg-accent2/15 text-accent2"
                  : active
                    ? "bg-accent text-white"
                    : "border border-line text-soft"
              }`}
            >
              {done ? <Icon name="check" className="h-2.5 w-2.5" /> : n}
            </span>
            <span className={`whitespace-nowrap ${active ? "font-semibold text-ink" : "text-soft"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
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
  editionName,
  topicSlug,
  lang,
  checkoutHref,
}: {
  paywall: Paywall | null;
  kind: "lesson" | "reference";
  editionName?: string;
  // The Edition being bought — passed by the AUTHED reader only, to look up a
  // pending bank transfer. The Guest reader passes neither (no account to have
  // one against), which is what skips the query there.
  topicSlug?: string;
  lang?: string;
  // Where "Unlock the full course" goes: the checkout page for this Edition,
  // built by `checkoutLink()`. Both readers pass it and it is always a link —
  // signed out, that URL renders `SignIn` and returns here after auth.
  checkoutHref: string;
}) {
  const t = useTranslations("Checkout");
  const price = paywall ? formatPrice(paywall.amount, paywall.currency) : null;
  // A pending bank transfer (manual EFT rail): an EFT clears in hours or days, so
  // a buyer who comes back before the operator confirms must see that we're
  // waiting for their money — the bare paygate reappearing reads as "my payment
  // failed". Reactive: it clears itself the moment the confirmation grants access.
  const pendingEft = useQuery(api.eft.myEftIntent, topicSlug && lang ? { topicSlug, lang } : "skip");
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
          <Link href={checkoutHref} className={ctaClass}>
            {t("unlockFullCourse")}
          </Link>
          {price && <span className="text-2xl font-semibold tabular-nums text-ink">{price}</span>}
        </div>
        {pendingEft ? (
          <p className="mt-3 rounded-xl border border-gold/40 bg-gold/10 p-3 text-xs leading-relaxed text-soft">
            {t("eftPendingNote", { ref: pendingEft.ref })}{" "}
            {/* The reference lives on the checkout page, which is now a real URL —
                so the note that says "we're waiting for your transfer" can point at
                the panel the buyer needs to reread it from. */}
            <Link href={checkoutHref} className="font-semibold text-accent2 underline-offset-2 hover:underline">
              {t("eftPendingLink")}
            </Link>
          </p>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-soft">
            <Icon name="globe" className="h-3.5 w-3.5 text-accent2" />
            {t("payFastNote")}
          </p>
        )}
      </div>
    </div>
  );
}
