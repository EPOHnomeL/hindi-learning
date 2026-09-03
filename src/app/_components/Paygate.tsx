"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { type CheckoutStep } from "./checkoutDerive";
import { useCountry } from "./CountryContext";
import { Icon } from "./icons";
import { priceView } from "./priceDerive";

// The paygate (paid marketplace, ADR 0016 / PayFast rail). A caller reading a
// PAID Edition they don't hold gets the free Preview (the first Lesson); every
// other Lesson and Reference renders this in place of the content — an explicit
// locked state, never a blank pane. Checkout is auth-first (ADR 0021), and it is
// a PAGE (`/checkout/<slug>/<lang>`, CheckoutPage.tsx), not a dialog — so
// everything here does is name the price and link to it. One CTA, one target,
// signed in or out: signed out the link lands on `SignIn` at that same URL.

// `usdAmount` / `eurAmount` are the seller's optional regional price points, in
// the FOREIGN currency's minor units (ticket 11 §4) — absent means that region
// pays the base Rand `amount`. Which of the three a given buyer sees is
// `priceView()`; nothing here picks it.
export type Paywall = {
  amount: number;
  currency: string;
  previewKey: string | null;
  usdAmount?: number;
  eurAmount?: number;
};

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

// What this buyer is quoted, formatted: their own currency's figure, plus the
// Rand that will actually hit their card when the two differ (ticket 11 §3 —
// "$10.00", then "charged as R184.00 (ZAR)"). Null for a free Edition.
//
// A hook rather than a component because the two money surfaces frame the same
// two strings very differently — a 2xl figure beside a CTA on the locked card, a
// gold pill in the checkout summary — while the rule for WHICH figure must be
// one rule. The Rand is `priceView`'s, which is `chargeCents`, which is what
// `startCheckout` freezes: the disclosed number is provably the charged number.
export function useDisplayPrice(paywall: Paywall | null | undefined): { main: string; charged: string | null } | null {
  const view = priceView(paywall, useCountry());
  if (!view) return null;
  return {
    main: formatPrice(view.amount, view.currency),
    // Absent for a base-region buyer: they are quoted Rand and charged Rand, so
    // there is nothing to disclose and the line would only add noise.
    charged: view.chargedZarCents === null ? null : formatPrice(view.chargedZarCents, "zar"),
  };
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
// longer still. `whitespace-nowrap` makes a regression here overflow visibly
// instead of silently re-wrapping.
//
// Two sizes, and the SMALL one is the base (ywampotch-launch/14). At the full
// size below, four labels plus their markers measure ~275px — which fits the
// 384px card on a 375px phone and OVERFLOWS a 320px one, where the rail's own
// box leaves ~256px. Afrikaans ("Rekening") is the longest and goes first. The
// compact base trims the markers, the separators and a point of type to land
// near ~220px, so the smallest phone we sell to holds one line too; `sm:`
// restores the roomier row everywhere it fits.
export function CheckoutSteps({ current }: { current: CheckoutStep }) {
  const t = useTranslations("Checkout");
  const steps = [t("stepAccount"), t("stepMethod"), t("stepPay"), t("stepCourse")];
  return (
    <ol className="flex items-center justify-center gap-0.5 text-[10px] leading-none sm:gap-1 sm:text-[11px]">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-1">
            {/* A hairline instead of a chevron: at this size a "›" glyph sat on
                a different baseline to the markers and read as punctuation
                inside the label rather than a separator between steps. */}
            {i > 0 && <span aria-hidden className="me-0.5 h-px w-1.5 bg-line sm:me-1 sm:w-2.5" />}
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold sm:h-4.5 sm:w-4.5 ${
                done
                  ? "bg-accent2/15 text-accent2"
                  : active
                    ? "bg-accent text-white"
                    : "border border-line text-soft"
              }`}
            >
              {done ? <Icon name="check" className="h-2 w-2 sm:h-2.5 sm:w-2.5" /> : n}
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
  const price = useDisplayPrice(paywall);
  // A pending bank transfer (manual EFT rail): an EFT clears in hours or days, so
  // a buyer who comes back before the operator confirms must see that we're
  // waiting for their money — the bare paygate reappearing reads as "my payment
  // failed". Reactive: it clears itself the moment the confirmation grants access.
  const pendingEft = useQuery(api.eft.myEftIntent, topicSlug && lang ? { topicSlug, lang } : "skip");
  const heading = kind === "reference" ? t("referenceLockedTitle") : t("courseLockedTitle");
  // Full-width tap target on a phone, hugging its label from `sm:` up. At 320px
  // the card leaves ~260px of content, and the button plus a `text-2xl` price
  // side by side needs ~280 — so they used to wrap, dropping the price under a
  // left-aligned button in a ragged L. Stacked deliberately instead.
  const ctaClass =
    "block w-full rounded-[10px] bg-accent px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-accent/90 sm:w-auto";

  return (
    <div className="flex min-h-[60svh] flex-1 items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md rounded-2xl border border-gold/40 bg-card p-5 shadow-sm sm:p-7">
        <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold sm:h-11 sm:w-11">
          <Icon name="lock" />
        </span>
        <h3 className="text-lg font-semibold tracking-tight text-balance text-ink">{heading}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-soft">
          {t("unlockEditionBody", {
            edition: editionName ? t("namedEdition", { name: editionName }) : t("thisEdition"),
          })}
        </p>
        {/* Price BEFORE the CTA, and on its own line on a phone: it's what the
            buyer is deciding on, so it can't sit downstream of the button that
            commits to it. From `sm:` they share a row again, price to the right,
            which is the desktop shape this card already had. */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-end sm:gap-4">
          {price && (
            <div className="sm:text-end">
              <span className="text-2xl font-semibold tabular-nums text-ink">{price.main}</span>
              {/* The anti-surprise line (ticket 11 §3). A buyer quoted $10 whose
                  statement then reads Rand is a chargeback waiting to happen, and
                  the same tenant's donation widget already discloses its Rand
                  line — omitting it here would have one site saying both things. */}
              {price.charged && (
                <span className="block text-xs text-soft">{t("chargedAs", { price: price.charged })}</span>
              )}
            </div>
          )}
          <Link href={checkoutHref} className={ctaClass}>
            {t("unlockFullCourse")}
          </Link>
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
