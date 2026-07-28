"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { type FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { LANGUAGES } from "../../../convex/languages";
import { Icon } from "./icons";
import { formatPrice } from "./Paygate";
import { ConfirmDialog, Dialog, MenuItem } from "./ui";

// One row of the owner's Editions panel, straight from api.translate.editions.
type Edition = NonNullable<FunctionReturnType<typeof api.translate.editions>>["editions"][number];
// The translation engine for one Edition (translation-engine-picker): `free` fires
// the cloud translate Routine (no token cost, slower); `gemini` schedules the paid
// in-Convex action (spends tokens, faster).
type Engine = Edition["engine"];

// The Topic's Editions & sharing dialog (UI redesign): the source English Edition
// plus each translation is one entry of a single-row edition picker (a wrapping
// tab strip buckled at ~20 languages — five rows of tabs shoved the panel off
// screen), with a separate "add a language" button beside it. Sharing lives
// inside each ready edition — invite by email and a public-link on/off toggle.
// Translating/failed editions show their status + retry instead. Managing *who*
// has access & their progress is deferred to a dedicated dashboard.
// Reuses every existing query/mutation unchanged.
//
// Languages are always named in ENGLISH (`edition.name` / `LanguageInfo.name`),
// never their endonym: the owner picking an edition reads the app in English, and
// a strip of endonyms in twenty scripts is unreadable to them. `native` stays on
// the wire for the reader UI.
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
        <EditionsDialogSkeleton />
      ) : data === null ? (
        <EmptyPanel icon="x" tone="bad" message={t("loadError")} />
      ) : (
        <>
          {/* One row, always — the picker takes the slack and the add button is a
              fixed-width sibling, so 2 editions and 30 editions look identical. */}
          <div className="mb-5 flex items-center gap-2 border-b border-line pb-4">
            <EditionPicker editions={editions} value={tab} onSelect={setTab} />
            <button
              type="button"
              aria-label={t("addLanguage")}
              title={t("addLanguage")}
              onClick={() => setTab("add")}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === "add"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line text-soft hover:bg-hi hover:text-accent"
              }`}
            >
              <Icon name="plus" className="h-4.5 w-4.5" />
              <span className="hidden sm:inline">{t("addLanguage")}</span>
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

// The edition selector: one collapsed row showing the current edition, opening a
// scrollable listbox of every edition. Filterable once the list outgrows a
// glance (a course with 20+ editions is the case this UI exists for). Replaces
// the old wrapping tab strip; keeps its per-edition affordances (English name, a
// "Source" badge for English, a status dot).
function EditionPicker({
  editions,
  value,
  onSelect,
}: {
  editions: Edition[];
  value: string;
  onSelect: (lang: string) => void;
}) {
  const t = useTranslations("Editions");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside / Esc close, same contract as EditionDangerMenu's dropdown.
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

  const selected = editions.find((e) => e.lang === value) ?? null;
  const needle = q.trim().toLowerCase();
  const matches = needle
    ? editions.filter((e) => e.name.toLowerCase().includes(needle) || e.lang.toLowerCase().includes(needle))
    : editions;
  // Search only earns its row once scanning the list stops being instant.
  const searchable = editions.length > 6;

  const pick = (lang: string) => {
    onSelect(lang);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setQ("");
        }}
        className={`flex w-full items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors hover:bg-hi ${
          open ? "border-accent" : "border-line"
        }`}
      >
        <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-wide text-accent2">{t("editionLabel")}</span>
        <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${selected ? "text-ink" : "text-soft"}`}>
          {selected ? selected.name : t("selectEdition")}
        </span>
        {selected && <EditionBadges edition={selected} />}
        <Icon name="chevron" className={`h-4 w-4 shrink-0 text-soft transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="pop-in absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl border border-line bg-card p-1.5 shadow-xl">
          {searchable && (
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                // Enter takes the top match — the whole point of typing here.
                if (e.key === "Enter" && matches[0]) {
                  e.preventDefault();
                  pick(matches[0].lang);
                }
              }}
              placeholder={t("searchLanguages")}
              className="mb-1.5 w-full rounded-lg border border-line bg-paper px-2.5 py-2 text-sm focus:border-gold focus:outline-none"
            />
          )}
          {matches.length > 0 ? (
            <ul role="listbox" aria-label={t("tablistLabel")} className="max-h-64 overflow-y-auto">
              {matches.map((ed) => (
                <li key={ed.lang} role="option" aria-selected={ed.lang === value}>
                  <button
                    type="button"
                    onClick={() => pick(ed.lang)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-hi ${
                      ed.lang === value ? "font-semibold text-accent" : "text-ink"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{ed.name}</span>
                    <EditionBadges edition={ed} />
                    {ed.lang === value && <Icon name="check" className="h-3.75 w-3.75 shrink-0 text-accent" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2.5 py-2 text-xs text-soft">{t("noMatchingLanguage")}</p>
          )}
        </div>
      )}
    </div>
  );
}

// An edition's inline markers: a "Source" badge for English, and a status dot
// (amber pulse = translating, red = failed, nothing = ready).
function EditionBadges({ edition }: { edition: Edition }) {
  const t = useTranslations("Editions");
  return (
    <>
      {edition.source && (
        <span className="shrink-0 rounded-full bg-accent2/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-accent2">
          {t("sourceBadge")}
        </span>
      )}
      {edition.status === "translating" && (
        <span className="h-1.75 w-1.75 shrink-0 animate-pulse rounded-full bg-gold" title={t("translatingStatus")} aria-hidden />
      )}
      {edition.status === "failed" && (
        <span className="h-1.75 w-1.75 shrink-0 rounded-full bg-danger" title={t("failedStatus")} aria-hidden />
      )}
    </>
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
    <div className="flex flex-col gap-4">
      <InviteByEmail topicSlug={topicSlug} lang={edition.lang} />
      <PublishToggle topicSlug={topicSlug} lang={edition.lang} published={edition.published} />
      <PublicLinkToggle topicSlug={topicSlug} lang={edition.lang} publicToken={edition.publicToken} />
      <SellEdition topicSlug={topicSlug} lang={edition.lang} name={edition.name} completed={completed} />
      <div className="flex flex-col items-start gap-3 border-t border-line pt-4">
        <AccessRoster topicSlug={topicSlug} lang={edition.lang} />
        {/* Destructive actions (regenerate link, re-translate, remove) live behind a
            two-click danger menu with a confirm — see EditionDangerMenu. */}
        <EditionDangerMenu topicSlug={topicSlug} edition={edition} />
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

// Whether this edition is listed in the site's course catalogue
// (course-publishing), as an on/off toggle — the owner's publish control. Sits
// above the public link because it is the broader act, and is deliberately a
// separate switch: publishing lists the edition for signed-in members (and, while
// it is free, lets them read it), whereas a public link hands anonymous access to
// anyone holding the token.
function PublishToggle({ topicSlug, lang, published }: { topicSlug: string; lang: string; published: boolean }) {
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
            setBusy(true);
            void setPublished({ topicSlug, lang, published: e.target.checked }).finally(() => setBusy(false));
          }}
          className="peer sr-only"
        />
        <span className="relative h-6 w-10.5 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-accent2 peer-checked:after:translate-x-4.5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
      </label>
    </div>
  );
}

// The anonymous public link for one edition, presented as an on/off toggle. Off →
// a lock; on → a globe, the URL revealed below with Copy. Turning it on mints a
// fresh token; turning it off revokes it. Regenerating (minting a new token while
// on) is a destructive action, so it lives in the edition's danger menu, not here.
// Token is read live from the reactive editions query.
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

      {/* Shift-free (mobile polish): the link row always renders — greyed out and
          disabled while sharing is off — so toggling doesn't resize the panel. */}
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
                /* clipboard blocked — the field is selectable to copy by hand */
              },
            );
          }}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            on ? "bg-accent2 text-white hover:bg-accent2/90" : "cursor-not-allowed bg-soft/10 text-soft/50"
          }`}
        >
          <Icon name="link" className="h-3.5 w-3.5" /> {copied ? t("copied") : t("copy")}
        </button>
      </div>
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
                  native: () => <span>{name}</span>,
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

// The ready edition's destructive-action menu, at the foot of the panel. Every
// action here either invalidates a shared link or throws work away, so each one
// is two clicks deep (open the menu, pick the action) and then gated by an
// "are you sure" confirm. A translation gets all three (regenerate the public
// link, re-translate, remove); the English source can only regenerate its link —
// it has no engine to re-run and can't be removed. Regenerate only appears while
// the public link is on (there's no token to replace otherwise), so the source
// with its link off shows no menu at all.
function EditionDangerMenu({ topicSlug, edition }: { topicSlug: string; edition: Edition }) {
  const t = useTranslations("Editions");
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "regenerate" | "retranslate" | "remove">(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close the dropdown on click-outside / Esc (the confirm dialogs handle their
  // own dismissal via the native <dialog>).
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
  // Source: only ever the (conditional) regenerate. Translation: all three.
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
          className="pop-in absolute bottom-[calc(100%+6px)] left-0 z-50 min-w-56 rounded-xl border border-line bg-card p-1.5 shadow-xl"
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

// "Are you sure?" for removing a translation edition: it and everyone's access to
// it go for good. Reuses removeEdition.
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

// "Are you sure?" for re-translating a ready edition (translation-engine-picker):
// carries the engine picker inside the confirm, seeded from the engine that last
// produced this edition. Switching engines forces a full redo server-side; the
// same engine is a cheap resume/repair. This is how a free edition is upgraded to
// Gemini. Its own <dialog> shell (not ConfirmDialog) so the engine toggle can sit
// above the buttons.
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
      <EmptyPanel icon="lock" tone="soft" message={t("translationLocked")} />
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
    : LANGUAGES.filter((l) => !present.has(l.code) && l.code !== "en").slice(0, 8);

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
      {/* Fixed-height, scrollable list (mobile polish): the panel keeps its height
          whether the query matches 8 languages, one, or none — no layout shift as
          the user types. Empty query pre-fills with suggestions. */}
      <div className="h-[290px] overflow-y-auto pr-0.5">
        {matches.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {matches.map((l) => (
              <li key={l.code}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => add(l.code)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-hi"
                >
                  {/* English name only — see the endonym note at the top of the file. */}
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

// A layout-locked empty-state card (mobile polish): the Editions dialog's
// "couldn't load" and "translation locked" states render at panel height, so the
// dialog doesn't resize when one of them replaces a real panel.
function EmptyPanel({ icon, tone, message }: { icon: "x" | "lock"; tone: "bad" | "soft"; message: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-card/30 p-8 text-center">
      <div
        className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
          tone === "bad" ? "bg-bad/15 text-danger" : "bg-hi text-soft"
        }`}
      >
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <p className="max-w-xs text-xs leading-relaxed text-soft">{message}</p>
    </div>
  );
}

function EditionsDialogSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Pulsing picker + add button — same one-row header the real dialog uses. */}
      <div className="mb-5 flex items-center gap-2 border-b border-line pb-4">
        <div className="h-10.5 flex-1 rounded-xl bg-soft/20" />
        <div className="h-10.5 w-32 rounded-xl bg-soft/20" />
      </div>
      {/* Panel skeleton */}
      <div className="flex flex-col gap-5">
        {/* Invite section skeleton */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="h-9 flex-1 rounded-lg bg-soft/20" />
            <div className="h-9 w-20 rounded-lg bg-soft/20" />
          </div>
          <div className="h-3.5 w-3/4 rounded bg-soft/10" />
        </div>
        {/* Public Link section skeleton */}
        <div className="h-[54px] rounded-xl border border-line bg-card/50 p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-[10px] bg-soft/20" />
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-24 rounded bg-soft/20" />
              <div className="h-3 w-48 rounded bg-soft/10" />
            </div>
          </div>
          <div className="h-6 w-11 rounded-full bg-soft/20" />
        </div>
      </div>
    </div>
  );
}
