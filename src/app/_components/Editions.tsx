"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { type FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { LANGUAGES } from "../../../convex/languages";
import { Icon } from "./icons";
import { formatPrice } from "./Paygate";
import { Dialog } from "./ui";

// One row of the owner's Editions panel, straight from api.translate.editions.
type Edition = NonNullable<FunctionReturnType<typeof api.translate.editions>>["editions"][number];

// The Topic's Editions & sharing dialog (UI redesign): the source English Edition
// plus each translation is a tab (a trailing "+" tab adds a language). Sharing
// lives inside each ready edition — invite by email and a public-link on/off
// toggle. Translating/failed editions show their status + retry instead. Managing
// *who* has access & their progress is deferred to a dedicated dashboard.
// Reuses every existing query/mutation unchanged.
export function EditionsDialog({ topicSlug, title, onClose }: { topicSlug: string; title: string; onClose: () => void }) {
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
    <Dialog title="Editions & sharing" onClose={onClose}>
      {data === undefined ? (
        <p className="text-sm text-soft">Loading…</p>
      ) : data === null ? (
        <p className="text-sm text-soft">Couldn’t load editions.</p>
      ) : (
        <>
          <div role="tablist" aria-label="Editions" className="mb-5 flex flex-wrap gap-1 border-b border-line">
            {editions.map((ed) => (
              <EditionTab key={ed.lang} edition={ed} active={tab === ed.lang} onSelect={() => setTab(ed.lang)} />
            ))}
            <button
              role="tab"
              aria-selected={tab === "add"}
              aria-label="Add a language"
              title="Add a language"
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
          Source
        </span>
      )}
      {edition.status === "translating" && (
        <span className="h-1.75 w-1.75 shrink-0 animate-pulse rounded-full bg-gold" title="Translating" aria-hidden />
      )}
      {edition.status === "failed" && (
        <span className="h-1.75 w-1.75 shrink-0 rounded-full bg-danger" title="Failed" aria-hidden />
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
  if (edition.status === "translating") {
    const pct = edition.total > 0 ? Math.round((edition.done / edition.total) * 100) : 0;
    return (
      <div className="flex flex-col items-start gap-3.5 rounded-xl border border-dashed border-line p-4 text-sm leading-relaxed text-soft">
        <p className="m-0">
          <b className="font-semibold text-ink" dir={edition.rtl ? "rtl" : undefined}>
            {edition.native}
          </b>{" "}
          is still translating ({edition.done}/{edition.total}). Sharing opens the moment it’s ready.
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
          Some items in <b className="font-semibold text-ink">{edition.native}</b> didn’t translate. Retry, then you can
          share it.
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
      <div className="flex flex-col items-start gap-2 border-t border-line pt-4">
        {/* The people/access list is deferred to a dedicated dashboard (issue
            filed) — this stays a quiet, non-interactive pointer for now. */}
        <div className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-line px-3 py-2.5 text-[12.5px] text-soft">
          <Icon name="users" className="h-4 w-4 shrink-0" />
          <span>See who has access &amp; their progress</span>
          <span className="ml-auto rounded-full bg-gold/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-gold">
            Soon
          </span>
        </div>
        {!edition.source && (
          <RemoveEdition topicSlug={topicSlug} lang={edition.lang} label="Remove this edition" />
        )}
      </div>
    </div>
  );
}

// Invite one person to this edition by email (read-only Viewer access). Scoped to
// `lang` — a Viewer gets exactly the Edition(s) shared with them.
function InviteByEmail({ topicSlug, lang }: { topicSlug: string; lang: string }) {
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
          setError("Couldn’t invite — please try again.");
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
          placeholder="Invite by email"
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Inviting…" : "Invite"}
        </button>
      </div>
      <p className="text-xs text-soft">Read-only access to this edition. No account yet? They’re in the moment they sign up.</p>
      {error && <p className="text-xs text-danger">{error}</p>}
      {done?.status === "shared" && <p className="text-xs text-accent2">Shared with {done.email}.</p>}
      {done?.status === "pending" && <p className="text-xs text-accent2">Invited {done.email} — they’ll get access when they sign up.</p>}
    </form>
  );
}

// The anonymous public link for one edition, presented as an on/off toggle. Off →
// a lock; on → a globe, the URL revealed below with Copy + a quiet Regenerate.
// Both "on" and "Regenerate" mint a fresh token (the old link dies); the toggle
// off revokes it. Token is read live from the reactive editions query.
function PublicLinkToggle({ topicSlug, lang, publicToken }: { topicSlug: string; lang: string; publicToken: string | null }) {
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
            <b className="block text-[13.5px] font-semibold text-ink">Public link</b>
            <span className="text-[11.5px] text-soft">
              {on ? "Anyone with the link can view — no account needed" : "Off — only you and people you invite can see this"}
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
              <Icon name="link" className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(true)}
            className="inline-flex items-center gap-1.5 self-start text-[12.5px] text-soft transition-colors hover:text-accent disabled:opacity-60"
          >
            <Icon name="refresh" className="h-3.75 w-3.75" /> Regenerate link
          </button>
        </div>
      )}
    </div>
  );
}

// Two-decimal currencies this ships with (matches Paygate.formatPrice's 2-decimal
// assumption — no zero-decimal currency like JPY, whose minor unit differs).
const SELL_CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD"];

// "Sell this edition" (paid marketplace, ADR 0016, Slice 2). Prices ONE Edition
// of a completed course. Setting a price makes the Edition paid (its first Lesson
// stays a free Preview; the rest needs a purchase); clearing it makes it free
// again. Guarded to a payouts-enabled Seller: a not-yet-Seller sees a "Set up
// selling" gate (Admin grant → Stripe payout onboarding) instead of the control.
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
  const status = useQuery(api.sellers.sellerStatus);
  const pricing = useQuery(api.market.editionPricing, { topicSlug });
  const setPrice = useMutation(api.market.setEditionPrice);
  const clearPrice = useMutation(api.market.clearEditionPrice);
  const startOnboarding = useAction(api.sellers.startOnboarding);

  const current = pricing?.find((p) => p.lang === lang) ?? null;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only a completed course is sellable (its content is frozen) — mirror the
  // AddLanguage "complete first" hint rather than showing a dead control.
  if (!completed) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-line px-3 py-2.5 text-[12.5px] text-soft">
        <Icon name="tag" className="h-4 w-4 shrink-0" />
        <span>Selling opens once the course is marked complete.</span>
      </div>
    );
  }

  // Seller gate: not a payouts-enabled Seller yet → the two-step "set up selling"
  // path (Admin grant, then Stripe onboarding), never the price control.
  if (status !== "ready") {
    const beginOnboarding = async () => {
      setBusy(true);
      setError(null);
      try {
        const { url } = await startOnboarding({ returnPath: "/?onboarding=return" });
        window.location.href = url;
      } catch {
        setError("Couldn’t open Stripe onboarding — please try again.");
        setBusy(false);
      }
    };
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-line px-3.5 py-3 text-[13px] leading-relaxed text-soft">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-hi text-accent">
          <Icon name="tag" className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          {status === undefined ? (
            <span>Checking your seller status…</span>
          ) : status === "not-granted" ? (
            <span>
              <b className="font-semibold text-ink">Sell this course.</b> Selling is enabled by the workspace admin —
              ask them to turn it on for your account.
            </span>
          ) : (
            <>
              <span>
                <b className="font-semibold text-ink">
                  {status === "granted-not-onboarded" ? "Set up payouts to sell." : "Finish your payout setup."}
                </b>{" "}
                Connect a Stripe account to receive payments; then you can price this edition.
              </span>
              <div className="mt-2.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void beginOnboarding()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
                >
                  {busy ? "Opening…" : status === "granted-not-onboarded" ? "Set up selling" : "Continue setup"}
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-danger">{error}</p>}
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
    setCurrency(current?.currency.toUpperCase() ?? "USD");
    setError(null);
    setOpen((o) => !o);
  };
  const save = async () => {
    const minor = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(minor) || minor <= 0) {
      setError("Enter a price greater than zero.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setPrice({ topicSlug, lang, amount: minor, currency });
      setOpen(false);
    } catch {
      setError("Couldn’t save the price — please try again.");
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
      setError("Couldn’t update — please try again.");
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
            <b className="block text-[13.5px] font-semibold text-ink">Sell this edition</b>
            <span className="text-[11.5px] text-soft">
              {current ? (
                <>
                  Paid · <span className="font-semibold text-gold">{formatPrice(current.amount, current.currency)}</span> ·
                  first lesson free
                </>
              ) : (
                <>
                  Free — set a price to sell{" "}
                  <span dir={rtl ? "rtl" : undefined}>{native}</span>
                </>
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
          {current ? "Edit price" : "Set a price"}
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex flex-wrap items-end gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">Price</span>
              <input
                value={amount}
                inputMode="decimal"
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                placeholder="0.00"
                className="w-32 rounded-lg border border-line bg-card px-3 py-2 text-sm tabular-nums focus:border-gold focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">Currency</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-28 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
              >
                {SELL_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
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
              <Icon name="x" className="h-3.75 w-3.75" /> Stop selling — make this edition free
            </button>
          ) : (
            <p className="text-xs text-soft">Each language is priced on its own — sell some editions, keep others free.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Retry a failed translation — re-runs startTranslation, which only reschedules
// the items that changed/failed.
function RetryTranslation({ topicSlug, lang }: { topicSlug: string; lang: string }) {
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
      <Icon name="refresh" className="h-4 w-4" /> {busy ? "Retrying…" : "Retry"}
    </button>
  );
}

// Remove a translation edition. A quiet danger text link by default; the failed/
// translating panels pass a shorter label.
function RemoveEdition({ topicSlug, lang, label = "Remove" }: { topicSlug: string; lang: string; label?: string }) {
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
      <Icon name="trash" className="h-3.75 w-3.75" /> {label}
    </button>
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
  const start = useAction(api.translate.startTranslation);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  if (!completed) {
    return (
      <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-soft">
        Translation unlocks once the course is marked complete (its content is frozen first).
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
    void start({ topicSlug, lang: code }).finally(() => setBusy(false));
    onAdded(code);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm text-soft">
        Translate this course into another language — it becomes a new tab you can share once ready.
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={busy}
        placeholder="Search languages…"
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
                  {l.rtl ? " · RTL" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {needle && matches.length === 0 && <p className="text-xs text-soft">No matching language.</p>}
    </div>
  );
}
