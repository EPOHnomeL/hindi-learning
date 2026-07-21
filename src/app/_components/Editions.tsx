"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { type FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { LANGUAGES } from "../../../convex/languages";
import { Icon } from "./icons";
import { formatPrice } from "./Paygate";
import { Dialog } from "./ui";

// One row of the owner's Editions panel, straight from api.translate.editions.
type Edition = NonNullable<FunctionReturnType<typeof api.translate.editions>>["editions"][number];
// The translation engine for one Edition (translation-engine-picker): `free` fires
// the cloud translate Routine (no token cost, slower); `gemini` schedules the paid
// in-Convex action (spends tokens, faster).
type Engine = Edition["engine"];

// The Topic's Editions & sharing dialog (UI redesign): the source English Edition
// plus each translation is a tab (a trailing "+" tab adds a language). Sharing
// lives inside each ready edition — invite by email and a public-link on/off
// toggle. Translating/failed editions show their status + retry instead. Managing
// *who* has access & their progress is deferred to a dedicated dashboard.
// Reuses every existing query/mutation unchanged.
export function EditionsDialog({ topicSlug, title, onClose }: { topicSlug: string; title: string; onClose: () => void }) {
  const t = useTranslations("Editions");
  const data = useQuery(api.translate.editions, { topicSlug });
  const [tab, setTab] = useState<string>("en"); // a lang code, or "add"
  // A language we just kicked off translating — we hold this until it appears in
  // the reactive query, then switch to its tab (so the user sees it start), rather
  // than switching immediately to a lang the query doesn't know about yet.
  const [pending, setPending] = useState<string | null>(null);

  const editions = data?.editions ?? [];

  // Once a just-added edition materialises, open its tab.
  useEffect(() => {
    if (pending && editions.some((e) => e.lang === pending)) {
      setTab(pending);
      setPending(null);
    }
  }, [editions, pending]);

  // If the open tab's edition was removed, fall back to the source. Skipped for a
  // pending add (that lang legitimately isn't in `editions` yet) so it doesn't
  // bounce off the new tab before it appears.
  useEffect(() => {
    if (tab !== "add" && tab !== pending && editions.length > 0 && !editions.some((e) => e.lang === tab)) {
      setTab("en");
    }
  }, [editions, tab, pending]);

  const active = editions.find((e) => e.lang === tab) ?? null;

  return (
    <Dialog title={t("dialogTitle")} onClose={onClose}>
      {data === undefined ? (
        <p className="text-sm text-soft">{t("loading")}</p>
      ) : data === null ? (
        <p className="text-sm text-soft">{t("loadError")}</p>
      ) : (
        <>
          <div role="tablist" aria-label={t("tablistLabel")} className="mb-5 flex flex-wrap gap-1 border-b border-line">
            {editions.map((ed) => (
              <EditionTab key={ed.lang} edition={ed} active={tab === ed.lang} onSelect={() => setTab(ed.lang)} />
            ))}
            <button
              role="tab"
              aria-selected={tab === "add"}
              aria-label={t("addLanguage")}
              title={t("addLanguage")}
              onClick={() => setTab("add")}
              className={`-mb-px inline-flex items-center rounded-t-lg border-b-2 px-3 py-2 transition-colors ${
                tab === "add" ? "border-accent text-accent" : "border-transparent text-soft hover:bg-hi hover:text-accent"
              }`}
            >
              <Icon name="plus" className="h-4.5 w-4.5" />
            </button>
          </div>

          {tab === "add" ? (
            <AddLanguagePanel
              topicSlug={topicSlug}
              editions={editions}
              completed={data.completed}
              onAdded={(code) => setTab(code)}
            />
          ) : active ? (
            <EditionPanel topicSlug={topicSlug} title={title} edition={active} completed={data.completed} />
          ) : null}
        </>
      )}
    </Dialog>
  );
}

// One edition tab: its endonym, a "Source" badge for English, and a status dot
// (amber pulse = translating, red = failed, none = ready).
function EditionTab({ edition, active, onSelect }: { edition: Edition; active: boolean; onSelect: () => void }) {
  const t = useTranslations("Editions");
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={`-mb-px inline-flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
        active ? "border-accent text-accent" : "border-transparent text-soft hover:bg-hi hover:text-accent"
      }`}
    >
      <span dir={edition.rtl ? "rtl" : undefined}>{edition.native}</span>
      {edition.source && (
        <span className="rounded-full bg-accent2/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-accent2">
          {t("sourceBadge")}
        </span>
      )}
      {edition.status === "translating" && (
        <span className="h-1.75 w-1.75 shrink-0 animate-pulse rounded-full bg-gold" title={t("translatingStatus")} aria-hidden />
      )}
      {edition.status === "failed" && (
        <span className="h-1.75 w-1.75 shrink-0 rounded-full bg-danger" title={t("failedStatus")} aria-hidden />
      )}
    </button>
  );
}

// The active edition's panel. Ready editions get the share controls; a
// translating one shows progress, a failed one shows retry — both with a quiet
// Remove (translations only; the source can't be removed).
function EditionPanel({
  topicSlug,
  title,
  edition,
  completed,
}: {
  topicSlug: string;
  title: string;
  edition: Edition;
  completed: boolean;
}) {
  const t = useTranslations("Editions");
  if (edition.status === "translating") {
    const pct = edition.total > 0 ? Math.round((edition.done / edition.total) * 100) : 0;
    return (
      <div className="flex flex-col items-start gap-3.5 rounded-xl border border-dashed border-line p-4 text-sm leading-relaxed text-soft">
        <p className="m-0">
          {t.rich("translatingProgress", {
            native: edition.native,
            done: edition.done,
            total: edition.total,
            b: (chunks) => (
              <b className="font-semibold text-ink" dir={edition.rtl ? "rtl" : undefined}>
                {chunks}
              </b>
            ),
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
            native: edition.native,
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
    <div className="flex flex-col gap-4">
      <InviteByEmail topicSlug={topicSlug} lang={edition.lang} />
      <PublicLinkToggle topicSlug={topicSlug} lang={edition.lang} publicToken={edition.publicToken} />
      <SellEdition topicSlug={topicSlug} lang={edition.lang} native={edition.native} rtl={edition.rtl} completed={completed} />
      {/* Only a translation can be re-translated — the English source has no engine. */}
      {!edition.source && (
        <RetranslateControls topicSlug={topicSlug} lang={edition.lang} currentEngine={edition.engine} />
      )}
      <div className="flex flex-col items-start gap-2 border-t border-line pt-4">
        <AccessRoster topicSlug={topicSlug} lang={edition.lang} />
        {!edition.source && (
          <RemoveEdition topicSlug={topicSlug} lang={edition.lang} label={t("removeThisEdition")} />
        )}
      </div>
    </div>
  );
}

// Invite one person to this edition by email (read-only Viewer access). Scoped to
// `lang` — a Viewer gets exactly the Edition(s) shared with them.
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

// The access roster for one Edition (ADR 0020): everyone the owner has granted
// access to — accepted people and pending invites — each with a Can view / Can
// edit toggle and a revoke control. Owner-only (the whole dialog is), reactive
// (a live query), so promoting/revoking/inviting reflects immediately. "Can
// edit" grants exactly the owner's in-place prose editing on this one Edition.
function AccessRoster({ topicSlug, lang }: { topicSlug: string; lang: string }) {
  const t = useTranslations("Editions");
  const roster = useQuery(api.shares.listEditionAccess, { topicSlug, lang });
  if (roster === undefined) return <p className="text-xs text-soft">{t("loadingAccess")}</p>;
  if (roster.length === 0) return <p className="text-xs text-soft">{t("noAccess")}</p>;
  return (
    <div className="flex w-full flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-soft">{t("whoHasAccess")}</p>
      <ul className="flex flex-col gap-1.5">
        {roster.map((entry) => (
          <AccessRow key={`${entry.status}:${entry.email}`} topicSlug={topicSlug} lang={lang} entry={entry} />
        ))}
      </ul>
    </div>
  );
}

// One roster row: the person's email (with a "pending" marker when they have no
// account yet), a Can view / Can edit segmented toggle (setShareRole), and a
// revoke control (revokeShare). Controls are identical for accepted and pending
// entries — the role rides through claim-on-signup.
function AccessRow({
  topicSlug,
  lang,
  entry,
}: {
  topicSlug: string;
  lang: string;
  entry: { email: string; role: "viewer" | "editor"; status: "accepted" | "pending" };
}) {
  const t = useTranslations("Editions");
  const setShareRole = useMutation(api.shares.setShareRole);
  const revokeShare = useMutation(api.shares.revokeShare);
  const [busy, setBusy] = useState(false);

  const setRole = (role: "viewer" | "editor") => {
    if (role === entry.role) return;
    setBusy(true);
    void setShareRole({ topicSlug, email: entry.email, lang, role }).finally(() => setBusy(false));
  };

  return (
    <li className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-ink" title={entry.email}>
          {entry.email}
        </span>
        {entry.status === "pending" && (
          <span className="text-[11px] text-soft">{t("pendingJoins")}</span>
        )}
      </div>
      <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-line text-[12px]">
        {(["viewer", "editor"] as const).map((role) => (
          <button
            key={role}
            type="button"
            disabled={busy}
            aria-pressed={entry.role === role}
            onClick={() => setRole(role)}
            className={`px-2.5 py-1 font-medium transition-colors disabled:opacity-60 ${
              entry.role === role ? "bg-accent text-white" : "bg-card text-soft hover:bg-hi"
            }`}
          >
            {role === "viewer" ? t("canView") : t("canEdit")}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={busy}
        aria-label={t("revokeAccessFor", { email: entry.email })}
        title={t("revokeAccess")}
        onClick={() => {
          setBusy(true);
          void revokeShare({ topicSlug, email: entry.email, lang }).finally(() => setBusy(false));
        }}
        className="shrink-0 rounded-lg p-1.5 text-soft transition-colors hover:bg-hi hover:text-danger disabled:opacity-60"
      >
        <Icon name="trash" className="h-3.75 w-3.75" />
      </button>
    </li>
  );
}

// The anonymous public link for one edition, presented as an on/off toggle. Off →
// a lock; on → a globe, the URL revealed below with Copy + a quiet Regenerate.
// Both "on" and "Regenerate" mint a fresh token (the old link dies); the toggle
// off revokes it. Token is read live from the reactive editions query.
function PublicLinkToggle({ topicSlug, lang, publicToken }: { topicSlug: string; lang: string; publicToken: string | null }) {
  const t = useTranslations("Editions");
  const setPublic = useMutation(api.shares.setEditionPublic);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const on = publicToken != null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = publicToken ? `${origin}/share/${publicToken}` : null;

  const run = (isPublic: boolean) => {
    setBusy(true);
    void setPublic({ topicSlug, lang, isPublic }).finally(() => setBusy(false));
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
            <span className="text-[11.5px] text-soft">
              {on ? t("publicOn") : t("publicOff")}
            </span>
          </div>
        </div>
        <label className="relative inline-flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            checked={on}
            disabled={busy}
            onChange={(e) => run(e.target.checked)}
            className="peer sr-only"
          />
          <span className="relative h-6 w-10.5 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-accent2 peer-checked:after:translate-x-4.5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
        </label>
      </div>

      {on && url && (
        <div className="mt-2.5 flex flex-col gap-2.5">
          <div className="flex gap-1.5">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-line bg-hi px-2.5 py-2 text-xs text-ink focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(url).then(
                  () => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  },
                  () => {
                    /* clipboard blocked — the field is selectable to copy by hand */
                  },
                );
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent2 px-3 py-2 text-xs font-medium text-white"
            >
              <Icon name="link" className="h-3.5 w-3.5" /> {copied ? t("copied") : t("copy")}
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(true)}
            className="inline-flex items-center gap-1.5 self-start text-[12.5px] text-soft transition-colors hover:text-accent disabled:opacity-60"
          >
            <Icon name="refresh" className="h-3.75 w-3.75" /> {t("regenerateLink")}
          </button>
        </div>
      )}
    </div>
  );
}

// The payout bank-details form (paid marketplace, PayFast rail): a granted
// Seller saves the SA bank account their earnings are EFT'd to — the step that
// makes them a ready Seller. Write-only by design: details are never read back
// into any non-admin UI, so the form always starts blank (re-submitting
// overwrites). Rendered inside the SellEdition gate.
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

// "Sell this edition" (paid marketplace, ADR 0016, Slice 2). Prices ONE Edition
// of a completed course. Setting a price makes the Edition paid (its first Lesson
// stays a free Preview; the rest needs a purchase); clearing it makes it free
// again. Guarded to a ready Seller: a not-yet-Seller sees a "Set up selling"
// gate (Admin grant → payout bank details) instead of the control.
// gold = paid/price throughout (the design system's monetisation colour).
function SellEdition({
  topicSlug,
  lang,
  native,
  rtl,
  completed,
}: {
  topicSlug: string;
  lang: string;
  native: string;
  rtl: boolean;
  completed: boolean;
}) {
  const t = useTranslations("Editions");
  const status = useQuery(api.sellers.sellerStatus);
  const pricing = useQuery(api.market.editionPricing, { topicSlug });
  const setPrice = useMutation(api.market.setEditionPrice);
  const clearPrice = useMutation(api.market.clearEditionPrice);

  const current = pricing?.find((p) => p.lang === lang) ?? null;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only a completed course is sellable (its content is frozen) — mirror the
  // AddLanguage "complete first" hint rather than showing a dead control.
  if (!completed) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-line px-3 py-2.5 text-[12.5px] text-soft">
        <Icon name="tag" className="h-4 w-4 shrink-0" />
        <span>{t("sellIncomplete")}</span>
      </div>
    );
  }

  // Seller gate: not a ready Seller yet → the two-step "set up selling" path
  // (Admin grant, then payout bank details — .scratch/payfast-payments), never
  // the price control. The bank-details form lands with ticket 02.
  if (status !== "ready") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-line px-3.5 py-3 text-[13px] leading-relaxed text-soft">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-hi text-accent">
          <Icon name="tag" className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          {status === undefined ? (
            <span>{t("checkingSellerStatus")}</span>
          ) : status === "payments-unconfigured" ? (
            // The deployment's PayFast rail isn't provisioned (env vars absent) —
            // selling is off platform-wide and enables itself when they land.
            <span>
              <b className="font-semibold text-ink">{t("paymentsUnconfiguredTitle")}</b> {t("paymentsUnconfiguredBody")}
            </span>
          ) : status === "not-granted" ? (
            <span>
              <b className="font-semibold text-ink">{t("notGrantedTitle")}</b> {t("notGrantedBody")}
            </span>
          ) : (
            <>
              <span>
                <b className="font-semibold text-ink">{t("addPayoutTitle")}</b> {t("addPayoutBody")}
              </span>
              <PayoutDetailsForm />
            </>
          )}
        </div>
      </div>
    );
  }

  // Ready Seller: the price control. Header shows the current state + a toggle to
  // the editor; the editor sets/updates the price or stops selling.
  const openEditor = () => {
    setAmount(current ? (current.amount / 100).toFixed(2) : "");
    setError(null);
    setOpen((o) => !o);
  };
  const save = async () => {
    const minor = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(minor) || minor <= 0) {
      setError(t("priceGreaterThanZero"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // ZAR-only (PayFast settles in Rand) — the server enforces the same.
      await setPrice({ topicSlug, lang, amount: minor, currency: "ZAR" });
      setOpen(false);
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
      setOpen(false);
    } catch {
      setError(t("updateError"));
    } finally {
      setBusy(false);
    }
  };

  return (
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
                  native: () => <span dir={rtl ? "rtl" : undefined}>{native}</span>,
                })
              )}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={openEditor}
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
        <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex flex-wrap items-end gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">{t("priceZar")}</span>
              <input
                value={amount}
                inputMode="decimal"
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                placeholder={t("pricePlaceholder")}
                className="w-32 rounded-lg border border-line bg-card px-3 py-2 text-sm tabular-nums focus:border-gold focus:outline-none"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
            >
              {busy ? t("saving") : t("save")}
            </button>
          </div>
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
      )}
    </div>
  );
}

// Retry a failed translation — re-runs startTranslation, which only reschedules
// the items that changed/failed.
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

// Remove a translation edition. A quiet danger text link by default; the failed/
// translating panels pass a shorter label.
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

// The Free / Gemini engine picker (translation-engine-picker): a segmented toggle
// with a per-engine hint below. Gemini's hint warns it uses tokens — the label IS
// the warning (no blocking confirm modal, per the PRD). Shared by the add-language
// panel and the ready-edition re-translate control.
function EngineToggle({ value, onChange, disabled }: { value: Engine; onChange: (e: Engine) => void; disabled?: boolean }) {
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

// Re-translate a ready edition (translation-engine-picker): an always-visible
// engine toggle seeded from the engine that last produced it, plus a Re-translate
// button. Switching to a different engine forces a full redo server-side; the same
// engine is a cheap resume/repair. This is how a free edition is upgraded to Gemini.
function RetranslateControls({ topicSlug, lang, currentEngine }: { topicSlug: string; lang: string; currentEngine: Engine }) {
  const t = useTranslations("Editions");
  const start = useAction(api.translate.startTranslation);
  const [engine, setEngine] = useState<Engine>(currentEngine);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col items-start gap-3 border-t border-line pt-4">
      <EngineToggle value={engine} onChange={setEngine} disabled={busy} />
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void start({ topicSlug, lang, engine }).finally(() => setBusy(false));
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
      >
        <Icon name="refresh" className="h-4 w-4" /> {busy ? t("retranslating") : t("retranslate")}
      </button>
    </div>
  );
}

// Add a translation edition: a searchable pick from LANGUAGES (excluding editions
// already present) that kicks off a bulk translation, then switches to the new
// tab. Only a completed course is translatable (content frozen), so otherwise it
// shows the unlock hint.
function AddLanguagePanel({
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
    return (
      <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-soft">
        {t("translationLocked")}
      </p>
    );
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
    : [];

  const add = (code: string) => {
    setBusy(true);
    setQ("");
    void start({ topicSlug, lang: code, engine }).finally(() => setBusy(false));
    onAdded(code);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm text-soft">
        {t("addLanguageIntro")}
      </p>
      <EngineToggle value={engine} onChange={setEngine} disabled={busy} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={busy}
        placeholder={t("searchLanguages")}
        className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none disabled:opacity-60"
      />
      {matches.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {matches.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                onClick={() => add(l.code)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-hi"
              >
                <span dir={l.rtl ? "rtl" : undefined}>{l.native}</span>
                <span className="shrink-0 text-xs text-soft">
                  {l.name}
                  {l.rtl ? t("rtlSuffix") : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {needle && matches.length === 0 && <p className="text-xs text-soft">{t("noMatchingLanguage")}</p>}
    </div>
  );
}
