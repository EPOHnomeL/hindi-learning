"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { type FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../../../../convex/_generated/api";
import { LANGUAGES } from "../../../../convex/languages";
import { Icon } from "../icons";
import { formatPrice } from "../Paygate";
import { ConfirmDialog, MenuItem } from "../ui";
import { EmptyPanel, Sheet, type Edition, type Engine } from "./shared";
import { VoucherCard } from "./VoucherCard";

// The Sharing peer of the manage route: ticket 15's three groups in order, as
// plain scrolling sections with small-caps labels. Per Edition; the shell's
// edition button picks which. Every query and mutation is unchanged from the
// dialog this replaces.
export function SharingTab({
  topicSlug,
  edition,
  completed,
  notify,
  onAddLanguage,
}: {
  topicSlug: string;
  edition: Edition;
  completed: boolean;
  notify: (message: string) => void;
  // Set only on a one-edition course, whose shell shows no edition button; the
  // quiet row at the foot is then the door to adding a language.
  onAddLanguage: (() => void) | null;
}) {
  const t = useTranslations("Editions");

  if (edition.status === "translating") {
    const pct = edition.total > 0 ? Math.round((edition.done / edition.total) * 100) : 0;
    return (
      <div className="flex flex-col items-start gap-3.5 rounded-xl border border-dashed border-line p-4 text-sm leading-relaxed text-soft">
        <p className="m-0">
          {t.rich("translatingProgress", {
            native: edition.name,
            done: edition.done,
            total: edition.total,
            b: (chunks) => <b className="font-semibold text-ink">{chunks}</b>,
          })}
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent2 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <RemoveEdition topicSlug={topicSlug} lang={edition.lang} />
      </div>
    );
  }

  if (edition.status === "failed") {
    return (
      <div className="flex flex-col items-start gap-3.5 rounded-xl border border-dashed border-line p-4 text-sm leading-relaxed text-soft">
        <p className="m-0">
          {t.rich("failedMessage", {
            native: edition.name,
            b: (chunks) => <b className="font-semibold text-ink">{chunks}</b>,
          })}
        </p>
        <div className="flex items-center gap-3">
          <RetryTranslation topicSlug={topicSlug} lang={edition.lang} />
          <RemoveEdition topicSlug={topicSlug} lang={edition.lang} />
        </div>
      </div>
    );
  }

  // Ready.
  return (
    <div className="flex flex-col gap-6">
      <Group label={t("groupFind")}>
        <PublishToggle topicSlug={topicSlug} lang={edition.lang} published={edition.published} notify={notify} />
      </Group>
      <Group label={t("groupHandTo")}>
        <PublicLinkToggle topicSlug={topicSlug} lang={edition.lang} publicToken={edition.publicToken} notify={notify} />
        <InviteByEmail topicSlug={topicSlug} lang={edition.lang} />
      </Group>
      <Group label={t("groupCosts")}>
        <SellEdition topicSlug={topicSlug} lang={edition.lang} name={edition.name} completed={completed} />
        {completed && (
          <VoucherCard topicSlug={topicSlug} lang={edition.lang} name={edition.name} published={edition.published} />
        )}
      </Group>
      <div className="flex flex-col items-start gap-3 border-t border-line pt-4">
        <EditionDangerMenu topicSlug={topicSlug} edition={edition} />
        {onAddLanguage && (
          <button
            type="button"
            onClick={onAddLanguage}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-[13px] font-medium text-soft transition-colors hover:bg-hi hover:text-accent"
          >
            <Icon name="plus" className="h-4 w-4" /> {t("addLanguage")}
          </button>
        )}
      </div>
    </div>
  );
}

// One of ticket 15's groups: a small-caps question as the label, controls under it.
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-soft">{label}</h3>
      {children}
    </section>
  );
}

// Whether this edition is listed in the site's course catalogue, as an on/off
// toggle. Deliberately separate from the public link: publishing lists the
// edition for signed-in members, a public link hands anonymous access to anyone
// holding the token. Publishing is orthogonal to price (CONTEXT.md): a priced
// published Edition is listed AND paygated.
function PublishToggle({
  topicSlug,
  lang,
  published,
  notify,
}: {
  topicSlug: string;
  lang: string;
  published: boolean;
  notify: (message: string) => void;
}) {
  const t = useTranslations("Editions");
  const setPublished = useMutation(api.catalogue.setEditionPublished);
  const [busy, setBusy] = useState(false);

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
        published ? "border-accent2/40" : "border-line"
      } bg-card`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-colors ${
            published ? "bg-accent2/15 text-accent2" : "bg-hi text-soft"
          }`}
        >
          <Icon name="book" className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <b className="block text-[13.5px] font-semibold text-ink">{t("publish")}</b>
          <span className="text-[11.5px] text-soft">{published ? t("publishOn") : t("publishOff")}</span>
        </div>
      </div>
      <label className="relative inline-flex shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          checked={published}
          disabled={busy}
          onChange={(e) => {
            const next = e.target.checked;
            setBusy(true);
            void setPublished({ topicSlug, lang, published: next })
              .then(() => notify(next ? t("toastPublishOn") : t("toastPublishOff")))
              .finally(() => setBusy(false));
          }}
          className="peer sr-only"
        />
        <span className="relative h-6 w-10.5 rounded-full bg-line transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-accent2 ltr:peer-checked:after:translate-x-4.5 rtl:peer-checked:after:-translate-x-4.5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
      </label>
    </div>
  );
}

// The anonymous public link for one edition, as an on/off toggle. Turning it on
// mints a fresh token; off revokes it. Regenerating lives in the danger menu.
// The link row always renders (greyed out while off) so toggling doesn't resize
// the column.
function PublicLinkToggle({
  topicSlug,
  lang,
  publicToken,
  notify,
}: {
  topicSlug: string;
  lang: string;
  publicToken: string | null;
  notify: (message: string) => void;
}) {
  const t = useTranslations("Editions");
  const setPublic = useMutation(api.shares.setEditionPublic);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const on = publicToken != null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = publicToken ? `${origin}/share/${publicToken}` : null;

  // ponytail: the QR code is a PNG data URL and the download is an anchor click,
  // same shape as the voucher CSV. `qrcode` is imported on the click so the
  // encoder never rides in the manage-page bundle for the owners who never
  // press it. 512px with a wide-ish margin is what a printed flyer needs.
  const downloadQr = async () => {
    if (!url) return;
    setQrBusy(true);
    try {
      const QRCode = (await import("qrcode")).default;
      const png = await QRCode.toDataURL(url, { width: 512, margin: 2 });
      const a = document.createElement("a");
      a.href = png;
      a.download = `${topicSlug}-${lang}-qr.png`;
      a.click();
    } catch {
      notify(t("qrError"));
    } finally {
      setQrBusy(false);
    }
  };

  const run = (isPublic: boolean) => {
    setBusy(true);
    void setPublic({ topicSlug, lang, isPublic })
      .then(() => notify(isPublic ? t("toastLinkOn") : t("toastLinkOff")))
      .finally(() => setBusy(false));
  };

  return (
    <div>
      <div
        className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
          on ? "border-accent2/40" : "border-line"
        } bg-card`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-colors ${
              on ? "bg-accent2/15 text-accent2" : "bg-hi text-soft"
            }`}
          >
            <Icon name={on ? "globe" : "lock"} className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <b className="block text-[13.5px] font-semibold text-ink">{t("publicLink")}</b>
            <span className="text-[11.5px] text-soft">{on ? t("publicOn") : t("publicOff")}</span>
          </div>
        </div>
        <label className="relative inline-flex shrink-0 cursor-pointer items-center">
          <input type="checkbox" checked={on} disabled={busy} onChange={(e) => run(e.target.checked)} className="peer sr-only" />
          <span className="relative h-6 w-10.5 rounded-full bg-line transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-accent2 ltr:peer-checked:after:translate-x-4.5 rtl:peer-checked:after:-translate-x-4.5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
        </label>
      </div>

      <div className="mt-2.5 flex gap-1.5">
        <input
          readOnly
          disabled={!on}
          value={on && url ? url : t("publicLinkDisabled")}
          onFocus={(e) => on && e.currentTarget.select()}
          className={`min-w-0 flex-1 rounded-lg border px-2.5 py-2 text-xs transition-colors focus:outline-none ${
            on ? "border-line bg-hi text-ink" : "border-line/60 bg-line/20 text-soft/60"
          }`}
        />
        <button
          type="button"
          disabled={!on || busy}
          onClick={() => {
            if (!url) return;
            navigator.clipboard?.writeText(url).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              },
              () => {
                /* clipboard blocked; the field is selectable to copy by hand */
              },
            );
          }}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            on ? "bg-accent2 text-white hover:bg-accent2/90" : "cursor-not-allowed bg-soft/10 text-soft/50"
          }`}
        >
          <Icon name="link" className="h-3.5 w-3.5" /> {copied ? t("copied") : t("copy")}
        </button>
        <button
          type="button"
          disabled={!on || busy || qrBusy}
          onClick={() => void downloadQr()}
          title={t("qrDownload")}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            on ? "border-line bg-hi text-ink hover:bg-line/40" : "cursor-not-allowed border-line/60 bg-soft/10 text-soft/50"
          }`}
        >
          <Icon name="qr" className="h-3.5 w-3.5" /> {t("qrCode")}
        </button>
      </div>
    </div>
  );
}

// Invite one person to this edition by email (read-only Viewer access). Scoped
// to `lang`: a Viewer gets exactly the Edition(s) shared with them. The roster
// the invites land in lives on the Users tab (ui-overhaul 17).
function InviteByEmail({ topicSlug, lang }: { topicSlug: string; lang: string }) {
  const t = useTranslations("Editions");
  const shareTopic = useMutation(api.shares.shareTopic);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string; status: "shared" | "pending" } | null>(null);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const addr = email.trim();
        if (!addr) return;
        setBusy(true);
        setError(null);
        try {
          const status = await shareTopic({ topicSlug, email: addr, lang });
          setDone({ email: addr, status });
          setEmail("");
        } catch {
          setError(t("inviteError"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
            setDone(null);
          }}
          placeholder={t("invitePlaceholder")}
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? t("inviting") : t("invite")}
        </button>
      </div>
      <p className="text-xs text-soft">{t("inviteHelp")}</p>
      {error && <p className="text-xs text-danger">{error}</p>}
      {done?.status === "shared" && <p className="text-xs text-accent2">{t("shared", { email: done.email })}</p>}
      {done?.status === "pending" && <p className="text-xs text-accent2">{t("invited", { email: done.email })}</p>}
    </form>
  );
}

type Pricing = FunctionReturnType<typeof api.market.editionPricing>[number];

// The "What it costs" row (ADR 0016; ui-overhaul 15/17). A ready Seller gets the
// price card. Anyone else gets ONE collapsed "Selling is off" row: the seller
// grant and payout details live inside it rather than on /settings, because an
// owner setting a price for the first time should discover why they cannot in
// the same place they are trying to. Turn on opens the two-step sheet the
// operator approved: payout details, then price. `payments-unconfigured` and
// `not-granted` stay read-only text; the owner can act on neither.
function SellEdition({
  topicSlug,
  lang,
  name,
  completed,
}: {
  topicSlug: string;
  lang: string;
  name: string;
  completed: boolean;
}) {
  const t = useTranslations("Editions");
  const status = useQuery(api.sellers.sellerStatus);
  const pricing = useQuery(api.market.editionPricing, { topicSlug });
  const current = pricing?.find((p) => p.lang === lang) ?? null;
  const [open, setOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  // Only a completed course is sellable (its content is frozen).
  if (!completed) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-line px-3 py-2.5 text-[12.5px] text-soft">
        <Icon name="tag" className="h-4 w-4 shrink-0" />
        <span>{t("sellIncomplete")}</span>
      </div>
    );
  }

  if (status !== "ready") {
    const line =
      status === undefined
        ? t("checkingSellerStatus")
        : status === "payments-unconfigured"
          ? t("paymentsUnconfiguredBody")
          : status === "not-granted"
            ? t("notGrantedBody")
            : t("addPayoutBody");
    // The one step the owner can clear themselves is their own payout details.
    const canTurnOn = status !== undefined && status !== "payments-unconfigured" && status !== "not-granted";
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-hi text-soft">
            <Icon name="tag" className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <b className="block text-[13.5px] font-semibold text-ink">{t("sellingOff")}</b>
            <span className="text-[11.5px] text-soft">{line}</span>
          </div>
        </div>
        {canTurnOn && (
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="shrink-0 rounded-lg bg-gold/20 px-3 py-1.5 text-[12.5px] font-medium text-accent transition-colors hover:bg-gold/30"
          >
            {t("turnOnSelling")}
          </button>
        )}
        {setupOpen && (
          <Sheet title={t("turnOnSellingTitle")} onClose={() => setSetupOpen(false)}>
            {/* Step 1: payout details. Saving flips sellerStatus reactively, and
                this same sheet becomes step 2, the price. */}
            <p className="text-[13px] leading-relaxed text-soft">
              <b className="font-semibold text-ink">{t("addPayoutTitle")}</b> {t("addPayoutBody")}
            </p>
            <PayoutDetailsForm />
          </Sheet>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={`rounded-xl border bg-card p-3.5 ${current ? "border-gold/40" : "border-line"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
                current ? "bg-gold/15 text-gold" : "bg-hi text-soft"
              }`}
            >
              <Icon name="tag" className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <b className="block text-[13.5px] font-semibold text-ink">{t("sellThisEdition")}</b>
              <span className="text-[11.5px] text-soft">
                {current ? (
                  t.rich("paidState", {
                    price: () => (
                      <span className="font-semibold text-gold">{formatPrice(current.amount, current.currency)}</span>
                    ),
                  })
                ) : (
                  t.rich("freeState", {
                    native: () => <span>{name}</span>,
                  })
                )}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              current
                ? "border border-line text-soft hover:bg-hi hover:text-accent"
                : "bg-gold/20 text-accent hover:bg-gold/30"
            }`}
          >
            {current ? t("editPrice") : t("setAPrice")}
          </button>
        </div>
        {open && (
          <div className="mt-3 border-t border-line pt-3">
            <PriceEditor topicSlug={topicSlug} lang={lang} current={current} onSaved={() => setOpen(false)} />
          </div>
        )}
      </div>
      {/* The turn-on sheet's step 2: the owner who just saved payout details
          lands here with the price fields, completing the approved two-step. */}
      {setupOpen && (
        <Sheet title={t("setAPrice")} onClose={() => setSetupOpen(false)}>
          <PriceEditor topicSlug={topicSlug} lang={lang} current={current} onSaved={() => setSetupOpen(false)} />
        </Sheet>
      )}
    </>
  );
}

// The price fields (base ZAR plus the two regional prices), shared by the ready
// card's inline editor and the turn-on sheet's second step. Regional prices are
// typed in the foreign currency; blank means that region pays the Rand price.
// The BASE price is ZAR-only (PayFast settles in Rand); the server enforces it.
function PriceEditor({
  topicSlug,
  lang,
  current,
  onSaved,
}: {
  topicSlug: string;
  lang: string;
  current: Pricing | null;
  onSaved: () => void;
}) {
  const t = useTranslations("Editions");
  const setPrice = useMutation(api.market.setEditionPrice);
  const clearPrice = useMutation(api.market.clearEditionPrice);
  const major = (minor: number | undefined) => (minor === undefined ? "" : (minor / 100).toFixed(2));
  // Seeded from what was last saved: a save writes all three fields, so a form
  // that opened blank would silently withdraw the regional prices on every edit.
  const [amount, setAmount] = useState(current ? (current.amount / 100).toFixed(2) : "");
  const [usd, setUsd] = useState(major(current?.usdAmount));
  const [eur, setEur] = useState(major(current?.eurAmount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const minor = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(minor) || minor <= 0) {
      setError(t("priceGreaterThanZero"));
      return;
    }
    // Blank means that region falls back to the Rand price. Anything typed must
    // be a real price: silently dropping a fat-fingered "1o.00" would sell at
    // R100 in New York.
    const regional = (raw: string): number | undefined | "bad" => {
      if (!raw.trim()) return undefined;
      const cents = Math.round(parseFloat(raw) * 100);
      return Number.isFinite(cents) && cents > 0 ? cents : "bad";
    };
    const usdAmount = regional(usd);
    const eurAmount = regional(eur);
    if (usdAmount === "bad" || eurAmount === "bad") {
      setError(t("priceGreaterThanZero"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setPrice({ topicSlug, lang, amount: minor, currency: "ZAR", usdAmount, eurAmount });
      onSaved();
    } catch {
      setError(t("savePriceError"));
    } finally {
      setBusy(false);
    }
  };
  const stopSelling = async () => {
    setBusy(true);
    setError(null);
    try {
      await clearPrice({ topicSlug, lang });
      onSaved();
    } catch {
      setError(t("updateError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2.5">
        {(
          [
            [t("priceZar"), amount, setAmount],
            [t("priceUsd"), usd, setUsd],
            [t("priceEur"), eur, setEur],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="flex flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">{label}</span>
            <input
              value={value}
              inputMode="decimal"
              onChange={(e) => {
                set(e.target.value);
                setError(null);
              }}
              placeholder={t("pricePlaceholder")}
              className="w-24 rounded-lg border border-line bg-card px-3 py-2 text-sm tabular-nums focus:border-gold focus:outline-none sm:w-32"
            />
          </label>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? t("saving") : t("save")}
        </button>
      </div>
      {/* Blank is a real answer here, and an unexplained blank field on a money
          form reads as one you forgot to fill in. */}
      <p className="text-xs text-soft">{t("regionalPriceHint")}</p>
      {error && <p className="text-xs text-danger">{error}</p>}
      {current ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void stopSelling()}
          className="inline-flex items-center gap-1.5 self-start text-[12.5px] text-soft transition-colors hover:text-danger disabled:opacity-60"
        >
          <Icon name="x" className="h-3.75 w-3.75" /> {t("stopSelling")}
        </button>
      ) : (
        <p className="text-xs text-soft">{t("eachLanguagePriced")}</p>
      )}
    </div>
  );
}

// The payout bank-details form (PayFast rail): a granted Seller saves the SA
// bank account their earnings are EFT'd to, the step that makes them a ready
// Seller. Write-only by design: details are never read back into any non-admin
// UI, so the form always starts blank (re-submitting overwrites).
function PayoutDetailsForm() {
  const t = useTranslations("Editions");
  const save = useMutation(api.sellers.savePayoutDetails);
  const [form, setForm] = useState({ accountHolder: "", bank: "", accountNumber: "", branchCode: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = (key: keyof typeof form, label: string, placeholder: string, inputMode?: "numeric") => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">{label}</span>
      <input
        value={form[key]}
        inputMode={inputMode}
        onChange={(e) => {
          setForm((f) => ({ ...f, [key]: e.target.value }));
          setError(null);
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
    </label>
  );

  return (
    <form
      className="mt-2.5 flex flex-col gap-2.5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await save(form);
        } catch {
          setError(t("payoutSaveError"));
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {field("accountHolder", t("accountHolder"), t("accountHolderPlaceholder"))}
        {field("bank", t("bank"), t("bankPlaceholder"))}
        {field("accountNumber", t("accountNumber"), t("accountNumberPlaceholder"), "numeric")}
        {field("branchCode", t("branchCode"), t("branchCodePlaceholder"), "numeric")}
      </div>
      <button
        type="submit"
        disabled={busy}
        className="self-start rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        {busy ? t("saving") : t("savePayoutDetails")}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

// Retry a failed translation. Re-runs startTranslation, which only reschedules
// the items that changed or failed.
function RetryTranslation({ topicSlug, lang }: { topicSlug: string; lang: string }) {
  const t = useTranslations("Editions");
  const retry = useAction(api.translate.startTranslation);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void retry({ topicSlug, lang }).finally(() => setBusy(false));
      }}
      className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
    >
      <Icon name="refresh" className="h-4 w-4" /> {busy ? t("retrying") : t("retry")}
    </button>
  );
}

// Remove a translation edition. A quiet danger text link by default; the
// failed/translating panels pass a shorter label.
function RemoveEdition({ topicSlug, lang, label }: { topicSlug: string; lang: string; label?: string }) {
  const t = useTranslations("Editions");
  const remove = useMutation(api.translate.removeEdition);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void remove({ topicSlug, lang }).finally(() => setBusy(false));
      }}
      className="inline-flex items-center gap-1.5 self-start text-[12.5px] text-soft transition-colors hover:text-danger disabled:opacity-60"
    >
      <Icon name="trash" className="h-3.75 w-3.75" /> {label ?? t("remove")}
    </button>
  );
}

// The Free / Gemini engine picker: a segmented toggle with a per-engine hint.
// Gemini's hint warns it uses tokens; the label IS the warning (no blocking
// confirm). Shared by the add-language panel and the re-translate confirm.
export function EngineToggle({ value, onChange, disabled }: { value: Engine; onChange: (e: Engine) => void; disabled?: boolean }) {
  const t = useTranslations("Editions");
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">{t("engineLabel")}</span>
      <div className="inline-flex self-start overflow-hidden rounded-lg border border-line text-[12.5px]">
        {(["free", "gemini"] as const).map((eng) => (
          <button
            key={eng}
            type="button"
            disabled={disabled}
            aria-pressed={value === eng}
            onClick={() => onChange(eng)}
            className={`px-3 py-1.5 font-medium transition-colors disabled:opacity-60 ${
              value === eng ? "bg-accent text-white" : "bg-card text-soft hover:bg-hi"
            }`}
          >
            {eng === "free" ? t("engineFree") : t("engineGemini")}
          </button>
        ))}
      </div>
      <span className="text-[11.5px] text-soft">{value === "gemini" ? t("engineGeminiWarn") : t("engineFreeHint")}</span>
    </div>
  );
}

// The ready edition's destructive-action menu, at the foot of the tab. Every
// action here either invalidates a shared link or throws work away, so each is
// two clicks deep and then gated by a confirm. A translation gets all three
// (regenerate the public link, re-translate, remove); the English source can
// only regenerate its link, and only while the link is on.
function EditionDangerMenu({ topicSlug, edition }: { topicSlug: string; edition: Edition }) {
  const t = useTranslations("Editions");
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "regenerate" | "retranslate" | "remove">(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const canRegenerate = edition.publicToken != null;
  if (edition.source && !canRegenerate) return null;

  const pick = (which: NonNullable<typeof confirm>) => {
    setOpen(false);
    setConfirm(which);
  };

  return (
    <div ref={ref} className="relative self-start">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-soft transition-colors hover:bg-hi hover:text-accent"
      >
        <Icon name="settings" className="h-4 w-4" />
        {t("manageEdition")}
        <Icon name="chevron" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="pop-in absolute bottom-[calc(100%+6px)] start-0 z-50 min-w-56 rounded-xl border border-line bg-card p-1.5 shadow-xl"
        >
          {canRegenerate && (
            <MenuItem icon="refresh" onClick={() => pick("regenerate")}>
              {t("regenerateLink")}
            </MenuItem>
          )}
          {!edition.source && (
            <MenuItem icon="refresh" onClick={() => pick("retranslate")}>
              {t("retranslate")}
            </MenuItem>
          )}
          {!edition.source && (
            <MenuItem icon="trash" onClick={() => pick("remove")}>
              {t("removeThisEdition")}
            </MenuItem>
          )}
        </div>
      )}

      {confirm === "regenerate" && (
        <RegenerateLinkConfirm topicSlug={topicSlug} lang={edition.lang} onClose={() => setConfirm(null)} />
      )}
      {confirm === "retranslate" && (
        <RetranslateConfirm topicSlug={topicSlug} edition={edition} onClose={() => setConfirm(null)} />
      )}
      {confirm === "remove" && (
        <RemoveEditionConfirm
          topicSlug={topicSlug}
          lang={edition.lang}
          native={edition.name}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// "Are you sure?" for regenerating the public link: minting a fresh token kills
// the link everyone already has. Reuses setEditionPublic (isPublic: true swaps
// the token in place).
function RegenerateLinkConfirm({ topicSlug, lang, onClose }: { topicSlug: string; lang: string; onClose: () => void }) {
  const t = useTranslations("Editions");
  const setPublic = useMutation(api.shares.setEditionPublic);
  const [busy, setBusy] = useState(false);
  return (
    <ConfirmDialog
      title={t("confirmRegenerateTitle")}
      body={t("confirmRegenerateBody")}
      confirmLabel={busy ? t("regenerating") : t("regenerateLink")}
      confirmDisabled={busy}
      onConfirm={() => {
        setBusy(true);
        void setPublic({ topicSlug, lang, isPublic: true }).then(onClose, () => setBusy(false));
      }}
      onClose={onClose}
    />
  );
}

// "Are you sure?" for removing a translation edition: it and everyone's access
// to it go for good. Reuses removeEdition.
function RemoveEditionConfirm({
  topicSlug,
  lang,
  native,
  onClose,
}: {
  topicSlug: string;
  lang: string;
  native: string;
  onClose: () => void;
}) {
  const t = useTranslations("Editions");
  const remove = useMutation(api.translate.removeEdition);
  const [busy, setBusy] = useState(false);
  return (
    <ConfirmDialog
      title={t("confirmRemoveTitle")}
      body={t("confirmRemoveBody", { native })}
      confirmLabel={busy ? t("removing") : t("removeThisEdition")}
      confirmDisabled={busy}
      onConfirm={() => {
        setBusy(true);
        void remove({ topicSlug, lang }).then(onClose, () => setBusy(false));
      }}
      onClose={onClose}
    />
  );
}

// "Are you sure?" for re-translating a ready edition: carries the engine picker
// inside the confirm, seeded from the engine that last produced this edition.
// Switching engines forces a full redo server-side; the same engine is a cheap
// resume/repair. Its own <dialog> shell (not ConfirmDialog) so the engine
// toggle can sit above the buttons.
function RetranslateConfirm({ topicSlug, edition, onClose }: { topicSlug: string; edition: Edition; onClose: () => void }) {
  const t = useTranslations("Common");
  const te = useTranslations("Editions");
  const start = useAction(api.translate.startTranslation);
  const [engine, setEngine] = useState<Engine>(edition.engine);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto w-[92vw] max-w-md rounded-2xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      <div className="px-6 py-5">
        <h2 className="text-base font-semibold text-accent">{te("confirmRetranslateTitle")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-soft">{te("confirmRetranslateBody", { native: edition.name })}</p>
        <div className="mt-4">
          <EngineToggle value={engine} onChange={setEngine} disabled={busy} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => ref.current?.close()}
            className="rounded-lg border border-line px-3 py-2 text-sm text-soft hover:bg-hi"
          >
            {t("cancel")}
          </button>
          <button
            onClick={() => {
              setBusy(true);
              void start({ topicSlug, lang: edition.lang, engine }).then(onClose, () => setBusy(false));
            }}
            disabled={busy}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {busy ? te("retranslating") : te("confirmRetranslate")}
          </button>
        </div>
      </div>
    </dialog>
  );
}

// Add a translation edition: a searchable pick from LANGUAGES (excluding
// editions already present) that kicks off a bulk translation. Only a completed
// course is translatable (content frozen), so otherwise it shows the unlock
// hint. Lives in the shell's edition sheet.
export function AddLanguagePanel({
  topicSlug,
  editions,
  completed,
  onAdded,
}: {
  topicSlug: string;
  editions: Edition[];
  completed: boolean;
  onAdded: (code: string) => void;
}) {
  const t = useTranslations("Editions");
  const start = useAction(api.translate.startTranslation);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  // Defaults to Free (translate for free first; upgrade to Gemini later per edition).
  const [engine, setEngine] = useState<Engine>("free");

  if (!completed) {
    return <EmptyPanel icon="lock" tone="soft" message={t("translationLocked")} />;
  }

  const present = new Set(editions.map((e) => e.lang));
  const needle = q.trim().toLowerCase();
  const matches = needle
    ? LANGUAGES.filter(
        (l) =>
          !present.has(l.code) &&
          (l.name.toLowerCase().includes(needle) ||
            l.native.toLowerCase().includes(needle) ||
            l.code.toLowerCase().includes(needle)),
      ).slice(0, 8)
    : LANGUAGES.filter((l) => !present.has(l.code) && l.code !== "en").slice(0, 8);

  const add = (code: string) => {
    setBusy(true);
    setQ("");
    void start({ topicSlug, lang: code, engine }).finally(() => setBusy(false));
    onAdded(code);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm text-soft">{t("addLanguageIntro")}</p>
      <EngineToggle value={engine} onChange={setEngine} disabled={busy} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={busy}
        placeholder={t("searchLanguages")}
        className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none disabled:opacity-60"
      />
      {/* Fixed-height, scrollable list: the panel keeps its height whether the
          query matches 8 languages, one, or none. Empty query pre-fills. */}
      <div className="h-[290px] overflow-y-auto pe-0.5">
        {matches.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {matches.map((l) => (
              <li key={l.code}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => add(l.code)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-start text-sm text-ink transition-colors hover:bg-hi"
                >
                  {/* English name only; see the endonym note in ManageShell. */}
                  <span className="min-w-0 truncate">{l.name}</span>
                  <span className="shrink-0 text-xs uppercase text-soft">
                    {l.code}
                    {l.rtl ? t("rtlSuffix") : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : needle ? (
          <p className="py-2 text-xs text-soft">{t("noMatchingLanguage")}</p>
        ) : (
          <p className="py-2 text-xs text-soft">{t("allLanguagesTranslated")}</p>
        )}
      </div>
    </div>
  );
}
