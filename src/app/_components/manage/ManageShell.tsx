"use client";

import { useAction, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { CourseSettingsBody } from "../CourseSettings";
import { DashboardTab } from "./DashboardTab";
import { Icon, type IconName } from "../icons";
import { IconButton } from "../ui";
import { EditionBadges, EmptyPanel, Sheet, type Edition } from "./shared";
import { AddLanguagePanel, SharingTab } from "./SharingTab";
import { UsersTab } from "./UsersTab";

type Tab = "sharing" | "users" | "settings" | "dashboard";

// The manage route's shell (ui-overhaul 16, R1 phone + D1 desktop): a two-row
// header (back, "Manage course", an edition button opening a sheet) over one
// underlined row of four iconed peer tabs, content in one centered column at
// both widths. Sharing is per Edition and is the only tab the edition button
// shows on; Users, Course settings and Dashboard are course-wide. Replaces the
// EditionsDialog, which dissolved into this shell. Reuses every existing query
// and mutation unchanged.
//
// Languages are always named in ENGLISH (`edition.name`), never their endonym:
// the owner picking an edition reads the app in English, and a list of endonyms
// in twenty scripts is unreadable to them.
export function ManageShell({ slug }: { slug: string }) {
  const t = useTranslations("Editions");
  const data = useQuery(api.translate.editions, { topicSlug: slug });
  const [tab, setTab] = useState<Tab>("sharing");
  const [lang, setLang] = useState("en");
  const [sheet, setSheet] = useState<null | "editions" | "add">(null);
  // A language we just kicked off translating, held until it appears in the
  // reactive query, then its edition opens (so the owner sees it start).
  const [pending, setPending] = useState<string | null>(null);
  // One transient toast; publish and link toggles confirm through it (the flow
  // the operator accepted with the prototype).
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const editions = data?.editions ?? [];

  useEffect(() => {
    if (pending && editions.some((e) => e.lang === pending)) {
      setLang(pending);
      setPending(null);
    }
  }, [editions, pending]);

  // If the active edition was removed, fall back to the source. Skipped for a
  // pending add (that lang legitimately isn't in `editions` yet).
  useEffect(() => {
    if (lang !== pending && editions.length > 0 && !editions.some((e) => e.lang === lang)) {
      setLang("en");
    }
  }, [editions, lang, pending]);

  const active = editions.find((e) => e.lang === lang) ?? null;

  const tabs: { key: Tab; icon: IconName; label: string }[] = [
    { key: "sharing", icon: "globe", label: t("tabSharing") },
    { key: "users", icon: "users", label: t("tabUsers") },
    { key: "settings", icon: "book", label: t("tabSettings") },
    { key: "dashboard", icon: "chart", label: t("tabDashboard") },
  ];

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[640px] px-4 pb-24">
      <header className="pt-4">
        <div className="flex items-center gap-2">
          <IconButton icon="chevron" label={t("backToCourses")} href="/" className="[&_svg]:rotate-90" variant="ghost" />
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-accent">{t("manageCourse")}</h1>
          {/* The edition button governs the Sharing and Course settings peers,
              both of which act on one edition (Settings joined them on
              2026-09-08, when the dashboard card's kebab door to Course settings
              closed and this became the only way to edit a translated edition's
              title and mission). Users and Dashboard are course-wide, and a
              one-edition course shows no button at all (its "Add a language"
              lives at the Sharing tab's foot instead). */}
          {(tab === "sharing" || tab === "settings") && editions.length > 1 && active && (
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setSheet("editions")}
              className="flex min-w-0 max-w-[45%] shrink items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-hi"
            >
              <span className="min-w-0 truncate">{active.name}</span>
              <EditionBadges edition={active} />
              <Icon name="chevron" className="h-3.5 w-3.5 shrink-0 text-soft" />
            </button>
          )}
        </div>
        <nav className="mt-3 flex border-b border-line" role="tablist" aria-label={t("manageCourse")}>
          {tabs.map(({ key, icon, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`-mb-px inline-flex min-w-0 flex-auto items-center justify-center gap-1.5 border-b-2 px-1 py-2.5 text-[12.5px] font-semibold transition-colors sm:flex-none sm:px-4 ${
                tab === key ? "border-accent text-accent" : "border-transparent text-soft hover:text-ink"
              }`}
            >
              {/* Icons from sm up only: at 360px four iconed labels cannot fit
                  untruncated, and the phone row the operator approved (R1) was
                  text-only. */}
              <Icon name={icon} className="hidden h-4 w-4 shrink-0 sm:block" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="py-5">
        {data === undefined ? (
          <ManageSkeleton />
        ) : data === null ? (
          <EmptyPanel icon="x" tone="bad" message={t("loadError")} />
        ) : tab === "sharing" ? (
          active ? (
            <SharingTab
              topicSlug={slug}
              edition={active}
              completed={data.completed}
              notify={notify}
              onAddLanguage={editions.length === 1 ? () => setSheet("add") : null}
            />
          ) : null
        ) : tab === "users" ? (
          <UsersTab topicSlug={slug} editions={editions} />
        ) : tab === "settings" ? (
          <SettingsTab topicSlug={slug} lang={lang} />
        ) : (
          <DashboardTab topicSlug={slug} editions={editions} onGoTo={setTab} />
        )}
      </main>

      {sheet === "editions" && (
        <Sheet title={t("editionSheetTitle")} onClose={() => setSheet(null)}>
          <EditionList
            editions={editions}
            value={lang}
            onSelect={(code) => {
              setLang(code);
              setSheet(null);
            }}
            onAdd={() => setSheet("add")}
          />
        </Sheet>
      )}
      {sheet === "add" && data && (
        <Sheet title={t("addLanguage")} onClose={() => setSheet(null)}>
          <AddLanguagePanel
            topicSlug={slug}
            editions={editions}
            completed={data.completed}
            onAdded={(code) => {
              setPending(code);
              setSheet(null);
            }}
          />
        </Sheet>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-[70] -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-[12.5px] font-medium text-paper shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

// The Course settings peer, and as of 2026-09-08 the ONLY door to course
// settings: the dashboard card's kebab closed, so Details here edits whichever
// edition the header's button names, which is what the dashboard dialog used to
// do by following the UI language. Status comes from the owner's own topics list.
// Ticket 20 redesigns the interior.
function SettingsTab({ topicSlug, lang }: { topicSlug: string; lang: string }) {
  const t = useTranslations("CourseSettings");
  const topics = useQuery(api.content.reader.listTopics);
  const topic = topics?.find((x) => x.slug === topicSlug) ?? null;
  if (topics === undefined) return <p className="text-[12.5px] text-soft">{t("loading")}</p>;
  if (!topic) return null;
  return (
    <>
      <CourseSettingsBody topicSlug={topicSlug} status={topic.status} lang={lang} />
      <AdminGenerationSection topicSlug={topicSlug} courseCompleted={topic.status === "completed"} />
    </>
  );
}

// The admin's "fire and pray": generate the remaining curriculum in one go, and
// cancel a run in flight. Self-gated on `amIAdmin`, and rendered for nobody else.
// It lived in the dashboard card's kebab until that menu went (2026-09-08); this
// is the course-wide settings surface, which is where the rest of the course
// lifecycle already sits.
function AdminGenerationSection({ topicSlug, courseCompleted }: { topicSlug: string; courseCompleted: boolean }) {
  const t = useTranslations("Dashboard");
  const amAdmin = useQuery(api.whitelist.amIAdmin);
  const status = useQuery(api.routine.generationStatus, { topicSlug });
  const finish = useAction(api.routine.finishGenerating);
  const cancel = useAction(api.routine.cancelFinishGenerating);
  const [busy, setBusy] = useState(false);
  if (!amAdmin || courseCompleted) return null;

  const generating = busy || status?.status === "generating";
  const cancelling = status?.cancelRequested === true;
  const failed = status?.status === "failed";

  return (
    <div className="mt-5 border-t border-line pt-5">
      {/* No heading: the button says what it does, and this is the only admin
          control on the page. Adding one would mean a new message key in six
          catalogues to name a section of one. */}
      <button
        type="button"
        disabled={generating && cancelling}
        onClick={() => {
          if (generating) {
            if (!cancelling) void cancel({ topicSlug });
            return;
          }
          setBusy(true);
          void finish({ topicSlug }).finally(() => setBusy(false));
        }}
        className="flex w-full items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5 text-start text-sm text-ink transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
      >
        <Icon name={generating ? "x" : "refresh"} className="h-4 w-4 shrink-0 text-soft" />
        {generating
          ? cancelling
            ? t("cancelling")
            : t("cancelGeneration")
          : failed
            ? t("finishGeneratingRetry")
            : t("finishGenerating")}
      </button>
    </div>
  );
}

// The edition sheet's list: every edition with badges and a tick, filterable
// once it outgrows a glance, plus the "Add a language" row at the foot.
function EditionList({
  editions,
  value,
  onSelect,
  onAdd,
}: {
  editions: Edition[];
  value: string;
  onSelect: (lang: string) => void;
  onAdd: () => void;
}) {
  const t = useTranslations("Editions");
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const matches = needle
    ? editions.filter((e) => e.name.toLowerCase().includes(needle) || e.lang.toLowerCase().includes(needle))
    : editions;

  return (
    <div className="flex flex-col gap-1.5">
      {editions.length > 6 && (
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) {
              e.preventDefault();
              onSelect(matches[0].lang);
            }
          }}
          placeholder={t("searchLanguages")}
          className="mb-1 w-full rounded-lg border border-line bg-card px-2.5 py-2 text-sm focus:border-gold focus:outline-none"
        />
      )}
      {matches.length > 0 ? (
        <ul role="listbox" aria-label={t("tablistLabel")} className="max-h-[50dvh] overflow-y-auto">
          {matches.map((ed) => (
            <li key={ed.lang} role="option" aria-selected={ed.lang === value}>
              <button
                type="button"
                onClick={() => onSelect(ed.lang)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-start text-sm transition-colors hover:bg-hi ${
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
      <button
        type="button"
        onClick={onAdd}
        className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-line px-2.5 py-2.5 text-start text-sm font-medium text-soft transition-colors hover:bg-hi hover:text-accent"
      >
        <Icon name="plus" className="h-4 w-4" /> {t("addLanguage")}
      </button>
    </div>
  );
}

function ManageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-[54px] rounded-xl border border-line bg-soft/10" />
      <div className="h-[54px] rounded-xl border border-line bg-soft/10" />
      <div className="h-24 rounded-xl border border-line bg-soft/10" />
    </div>
  );
}
