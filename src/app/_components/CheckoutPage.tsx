"use client";

import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { langInfo } from "../../../convex/languages";
import { checkoutStep } from "./checkoutDerive";
import { withLang } from "./editionUrl";
import { Icon } from "./icons";
import { CheckoutSteps, formatPrice } from "./Paygate";
import { postToPayFast } from "./payfastPost";

// The whole purchase, as a page (ywampotch-launch/12–13): `/checkout/<slug>/<lang>`.
// It was a dialog until the operator walked the live funnel and named the
// container as the problem — "too much popups". Nothing about the *sequence*
// changed in the move; this is the same content the dialog rendered, as page
// sections, plus the one state a dialog could never show (step 4, below).
//
// It sits inside `(app)`, so a signed-out visitor arriving from a share link
// gets `AppGate`'s `SignIn` at this very URL (ADR 0012) — that is the entire
// account step, for free, with no second sign-in form on the money surface. A
// sibling of `courses/`, so it inherits no `CourseShell` chrome: bare page.
//
// `lang` is a required path segment because an implicit language is the prod
// checkout bug — `resolveEdition` would serve a free published translation
// instead of the paid Edition's paygate (see editionUrl.ts's header note).
//
// `convex/` is untouched by this route: `courseHeader`, `market.startCheckout`,
// `eft.startEftPurchase` and `eft.myEftIntent` all already take `{topicSlug, lang}`,
// which is exactly what the path carries.
export function CheckoutPage({ topicSlug, lang }: { topicSlug: string; lang: string }) {
  const t = useTranslations("Checkout");
  const header = useQuery(api.content.reader.courseHeader, { topicSlug, lang });
  const startCheckout = useMutation(api.market.startCheckout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The manual EFT rail. `eftDetails` is null whenever the rail is off (or
  // unconfigured), so the second option simply doesn't exist then — and the
  // mutation refuses it server-side regardless. A pending intent from an earlier
  // visit shows the same instructions, so a buyer who bookmarked this URL days
  // ago comes back to their reference rather than to the chooser.
  const eftBank = useQuery(api.eft.eftDetails);
  const pendingEft = useQuery(api.eft.myEftIntent, { topicSlug, lang });
  const startEft = useMutation(api.eft.startEftPurchase);
  const [startedEft, setStartedEft] = useState<{ ref: string; amount: number; bank: typeof eftBank } | null>(null);
  const eft = startedEft ?? pendingEft;
  // Which method the buyer clicked, so only ITS label shows progress — both
  // options disable while either is in flight.
  const [method, setMethod] = useState<"eft" | "card" | null>(null);

  const checkout = async () => {
    setMethod("card");
    setBusy(true);
    setError(null);
    try {
      const { action, fields } = await startCheckout({ topicSlug, lang });
      postToPayFast(action, fields);
    } catch {
      setError(t("checkoutFailed"));
      setBusy(false);
    }
  };

  if (header === undefined) return <Shell>{null}</Shell>;
  // Signed in (AppGate) and still no header: no such course on this tenant, or
  // no Edition in this language. Nothing to sell, so say so rather than render
  // a chooser whose buttons would both throw.
  if (header === null) {
    return (
      <Shell>
        <p className="text-sm leading-relaxed text-soft">{t("courseUnavailable")}</p>
      </Shell>
    );
  }

  // Every role but `preview` already holds the Edition. Reachable two ways: a
  // holder opens the URL, or — the one that matters — an EFT buyer keeps this
  // page open until the operator confirms the transfer, and `courseHeader` flips
  // under them. That is step 4 arriving live, which is the whole argument for a
  // page over a dialog.
  const entitled = header.role !== "preview";
  const price = header.paywall ? formatPrice(header.paywall.amount, header.paywall.currency) : null;
  const editionName = header.lang !== "en" ? langInfo(header.lang).native : undefined;
  const courseHref = withLang(`/courses/${topicSlug}`, header.lang);

  return (
    <Shell
      step={checkoutStep({
        entitled,
        onEftInstructions: !!eft,
        redirectingToCard: busy && method === "card",
      })}
    >
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        {entitled ? t("ownedTitle") : t("unlockThisCourse")}
      </h1>

      {/* The purchase summary, persistent across every step: what is being
          bought, in which Edition, for how much. It lives in the body and not in
          the rail — the rail holds one line on a phone only because it carries
          nothing but the four one-word steps. */}
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <b className="block text-[15px] text-ink">{header.title}</b>
          <span className="text-xs text-soft">
            {t("editionLifetime", {
              edition: editionName ? t("editionName", { name: editionName }) : t("thisEditionTitle"),
            })}
          </span>
        </div>
        {price && (
          <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-bold tabular-nums text-gold">
            {price}
          </span>
        )}
      </div>

      {entitled ? (
        <div className="mt-4 rounded-xl border border-accent2/40 bg-accent2/10 p-4">
          <p className="flex items-start gap-2 text-sm leading-relaxed text-soft">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-accent2" />
            <span>{t("ownedBody")}</span>
          </p>
          <Link
            href={courseHref}
            className="mt-3.5 block rounded-[10px] bg-accent px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-accent/90"
          >
            {t("continueToCourse")}
          </Link>
        </div>
      ) : (
        <>
          {/* Everything below the summary is for the buyer who has NOT started a
              method yet. Once they're on the transfer screen, the sales pitch and
              the card reassurance are all noise in front of the numbers they came
              to copy — so that screen is the panel and nothing else. */}
          {!eft && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-hi/40 p-3.5 text-sm leading-relaxed text-soft">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-accent2" />
              <span>{t("unlockDialogBody", { edition: editionName ?? t("thisLanguage") })}</span>
            </div>
          )}

          {eft ? (
            <EftInstructions ref_={eft.ref} amount={eft.amount} bank={eft.bank} currency={"zar"} />
          ) : eftBank ? (
            /* Both rails live → one plain question, methods named by what the buyer
               HAS (their bank, their card), never by gateway brand — a buyer shouldn't
               need to know what PayFast is to choose. One click goes straight to that
               method's details: EFT to the bank-details panel, card to the PayFast
               redirect. The old bankGuidance note ("bank not under Instant EFT → pick
               Credit & Cheque card") is absorbed by this framing: EFT buyers never see
               PayFast's picker, card buyers were picking the card tile anyway. */
            <fieldset disabled={busy} className="mt-4 min-w-0">
              <legend className="text-sm font-semibold text-ink">{t("howToPay")}</legend>
              <div className="mt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setMethod("eft");
                    setBusy(true);
                    setError(null);
                    try {
                      setStartedEft(await startEft({ topicSlug, lang }));
                    } catch {
                      setError(t("eftFailed"));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="w-full rounded-[10px] border border-line px-4 py-3 text-left transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <b className="block text-sm font-semibold text-ink">{t("methodEftTitle")}</b>
                  <span className="mt-0.5 block text-xs leading-relaxed text-soft">{t("methodEftDesc")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void checkout()}
                  className="w-full rounded-[10px] border border-line px-4 py-3 text-left transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <b className="block text-sm font-semibold text-ink">
                    {busy && method === "card" ? t("redirecting") : t("methodCardTitle")}
                  </b>
                  <span className="mt-0.5 block text-xs leading-relaxed text-soft">{t("methodCardDesc")}</span>
                </button>
              </div>
            </fieldset>
          ) : (
            <>
              {/* Single rail (EFT off or still loading) — no chooser theatre for a
                  non-choice; today's one-button card flow stands, bank guidance and all.
                  This is what every tenant but YWAM Potch sees.

                  Bank-to-method guidance — the last surface we own before PayFast's
                  hosted picker, which is theirs to word. PayFast advertises 9 Instant
                  EFT banks but renders only 5 on this account (Absa, Standard Bank,
                  Capitec and African Bank are absent), so a buyer at one of those banks
                  picks the tile that sounds right, finds no bank, and abandons. "Credit
                  & Cheque card" is the answer for all of them, so that's all this says.
                  Both tile names are quoted VERBATIM from PayFast's picker and stay
                  English in every locale — a translated label is one the buyer can't
                  find on screen. Only in this single-rail branch: with the chooser, a
                  buyer headed to PayFast has already chosen card. ponytail: hardcodes
                  PayFast's CURRENT coverage. If they restore the four banks, delete
                  this note and the `bankGuidance` key rather than editing it. */}
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
                  disabled={busy}
                  className="mt-4 w-full rounded-[10px] bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busy ? t("redirecting") : price ? `${t("continueToPayFast")} · ${price}` : t("continueToPayFast")}
                </button>
              </form>
            </>
          )}

          {error ? (
            <p className="mt-2.5 text-center text-xs text-danger">{error}</p>
          ) : (
            !eft && (
              <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-xs text-soft">
                <Icon name="globe" className="h-3.5 w-3.5 text-accent2" /> {t("payFastNoteShort")}
              </p>
            )
          )}
          {/* Point-of-sale compliance: the refund policy (all sales final) linked where the buyer commits. */}
          <p className="mt-1 text-center text-xs text-soft">
            {t.rich("purchaseAgreement", {
              terms: (c) => (
                <Link href="/terms" className="text-accent2 underline-offset-2 hover:underline">
                  {c}
                </Link>
              ),
              refund: (c) => (
                <Link href="/refunds" className="text-accent2 underline-offset-2 hover:underline">
                  {c}
                </Link>
              ),
            })}
          </p>
        </>
      )}
    </Shell>
  );
}

// The page frame: the rail, then the current step's content. Narrow and centred
// because this is a phone screen first — the buyer arrives here from a WhatsApp
// share link far more often than from a desktop. The rail renders even while
// `courseHeader` is still in flight, so the page never opens as a blank pane.
function Shell({ step = 2, children }: { step?: ReturnType<typeof checkoutStep>; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-6 sm:py-10">
      {/* `px-2` on a phone — see CheckoutSteps: the rail is the widest row on
          this page and its own box was eating 32px of a 320px screen. */}
      <div className="rounded-xl border border-line bg-card px-2 py-3 sm:px-4">
        <CheckoutSteps current={step} />
      </div>
      <div className="mt-4 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">{children}</div>
    </div>
  );
}

// What the buyer needs to make the transfer: the amount, the operator's account,
// and — the whole mechanism — THEIR reference. Without the reference the operator
// receives a transfer labelled with someone's surname and has to work out by hand
// who bought which Edition, which is the step that breaks first, and it breaks
// silently, in money. So the reference is the loudest thing on the page.
//
// No proof-of-payment upload (ticket 03, out of scope): the bank statement already
// tells the operator what arrived. Access is granted when the operator confirms —
// nothing here grants anything.
function EftInstructions({
  ref_,
  amount,
  bank,
  currency,
}: {
  ref_: string;
  amount: number;
  bank: { accountHolder: string; bank: string; accountNumber: string; branchCode: string } | null | undefined;
  currency: string;
}) {
  const t = useTranslations("Checkout");
  if (!bank) return null;
  return (
    <div className="mt-4 rounded-xl border border-gold/40 bg-gold/10 p-4">
      <p className="text-sm leading-relaxed text-soft">{t("eftBody", { price: formatPrice(amount, currency) })}</p>

      {/* The reference and the account are what the buyer is here to copy into a
          banking app — often on a phone, sometimes retyped by hand — so they are set
          at reading size and left selectable, and nothing competes with them. */}
      <div className="mt-3.5 rounded-lg border border-gold/50 bg-card px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent2">{t("eftReference")}</span>
        <b className="mt-0.5 block select-all text-2xl font-bold tracking-[0.12em] text-ink">{ref_}</b>
      </div>
      <dl className="mt-3.5 flex flex-col gap-2 rounded-lg border border-gold/50 bg-card px-4 py-3 text-[15px]">
        {(
          [
            [t("eftAccountName"), bank.accountHolder, false],
            [t("eftBankLabel"), bank.bank, false],
            [t("eftAccountNumber"), bank.accountNumber, true],
            [t("eftBranchCode"), bank.branchCode, true],
          ] as const
        ).map(([label, value, numeric]) => (
          <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <dt className="text-sm text-soft">{label}</dt>
            <dd className={`select-all font-semibold text-ink ${numeric ? "text-lg tabular-nums tracking-wide" : ""}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3.5 text-xs leading-relaxed text-soft">{t("eftWait")}</p>

      {/* The way out. Without it this panel is a dead end: the buyer has made the
          transfer, there is nothing left to do here, and every other route out of
          checkout belongs to a rail that completes in the browser. The overview
          is the right destination because that is where the wait is now visible —
          the course sits there under "Awaiting payment" with this reference until
          the operator confirms it (`eft.myPendingIntents`). */}
      <Link
        href="/"
        className="mt-4 block rounded-[10px] bg-accent px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-accent/90"
      >
        {t("eftDone")}
      </Link>
    </div>
  );
}
