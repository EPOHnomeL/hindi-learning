"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { CompletionCelebration } from "./Certificate";
import { CourseSettingsDialog } from "./CourseSettings";
import { Icon } from "./icons";
import { LANG_KEY, useEditionLang, withLang } from "./editionUrl";
import { ResourceItem } from "./ResourceItem";
import { useTheme } from "./ThemeContext";
import { useHideOnScroll } from "./useHideOnScroll";
import { useResourceUpload } from "./useResourceUpload";
import { completedKeys, frontierKey, nextLessonKey, seenAfterOpening, unseenReplyKeys } from "./readerDerive";

// localStorage key for answered-question ids the learner has already seen.
const SEEN_KEY = "hindi:answers-seen";

// Course-scoped state shared from the course layout down to the Lesson page
// (ADR 0012). The sidebar (rendered here) reads the per-course queries directly;
// the page reaches back for `markSeen` (mark a lesson's replies seen on open) and
// `frontierKey` (is this the Frontier?).
type CourseCtx = {
  frontierKey: string | null;
  markSeen: (lessonKey: string) => void;
  // False for a read-only Viewer (a Topic shared with them): the reader then
  // hides every write control. Defaults false while access is still loading, so
  // a Viewer never sees a control flash before it's hidden.
  canWrite: boolean;
  // True once the Topic is `completed` (ADR 0015): the reader stops offering
  // "Generate next lesson". Defaults false while the header is still loading.
  completed: boolean;
  // The lesson after the given one in seq order (null on the last / unknown).
  // Powers the Viewer's "Next lesson →" link in place of write controls.
  nextKey: (lessonKey: string) => string | null;
  // The served Edition's text direction + language (course-translation), from the
  // header. Threaded to the artifact iframe so a translated Edition renders
  // RTL/localised. Defaults to ltr/en while the header is still loading.
  dir: "ltr" | "rtl";
  contentLang: string;
};
const Ctx = createContext<CourseCtx | null>(null);

export function useCourse(): CourseCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCourse must be used within CourseShell");
  return c;
}

// The course layout: a persistent sidebar (Lessons/References/Resources) plus the
// artifact pane (`children`). Mounted once per course — moving between Lessons
// swaps only `children`, so the queries below run once and the sidebar never
// remounts. Fixed by `slug` from the URL.
export function CourseShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  // One viewable query carries both the title (a Viewer's owner-only `listTopics`
  // never includes a shared Topic) and the caller's role. Owners can write;
  // Viewers get a read-only reader.
  // The Edition being read (course-translation): `?lang` from the URL, threaded
  // into every content query so the sidebar + nav follow the chosen language.
  // Progress is language-agnostic, so `myProgress` never takes `lang`.
  const lang = useEditionLang();
  const header = useQuery(api.content.courseHeader, { topicSlug: slug, lang: lang ?? undefined });
  const canWrite = header?.role === "owner";
  const courseCompleted = header?.status === "completed";
  const { signOut } = useAuthActions();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const navHidden = useHideOnScroll();

  const lessons = useQuery(api.content.listLessons, { topicSlug: slug, lang: lang ?? undefined });
  const references = useQuery(api.content.listReferences, { topicSlug: slug, lang: lang ?? undefined });
  const progress = useQuery(api.capture.myProgress, { topicSlug: slug });
  const questions = useQuery(api.capture.myQuestions, { topicSlug: slug, lang: lang ?? undefined });

  // Answered-question ids already seen (client-only, per device). A lesson with a
  // reply not in this set gets a notification dot; opening that lesson marks its
  // answers seen and clears the dot.
  const [seen, setSeen] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if (raw) setSeen(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* unavailable or corrupt storage — start empty */
    }
  }, []);

  // Paid marketplace (ADR 0016): a `preview` caller holds no access to a paid
  // Edition, so every Lesson past the free Preview (and every Reference) is locked
  // in the nav. The Preview itself — `paywall.previewKey` — is flagged Free.
  const preview = header?.role === "preview";
  const previewKey = header?.paywall?.previewKey ?? null;

  const completed = completedKeys(progress ?? []);
  const unseenAnswers = unseenReplyKeys(questions ?? [], seen);
  const frontier = frontierKey(lessons ?? []);
  const nextKey = useCallback((lessonKey: string) => nextLessonKey(lessons ?? [], lessonKey), [lessons]);

  // Opening a lesson counts as seeing its replies — persist the new set so the dot
  // stays cleared across reloads. No-ops (same reference) when nothing is new.
  // Stable per `questions` so the Lesson page's open-effect fires on lesson change
  // or a newly-arrived reply, not on every render.
  const markSeen = useCallback(
    (lessonKey: string) => {
      setSeen((prev) => {
        const next = seenAfterOpening(questions ?? [], lessonKey, prev);
        if (next === prev) return prev;
        try {
          localStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [questions],
  );

  // Which nav item is active, read from the URL.
  const isRef = pathname.includes("/references/");
  const activeKey = decodeURIComponent(pathname.split("/").pop() ?? "");

  // Selecting a Lesson/Reference navigates; close the mobile drawer when the route
  // changes. Keyed on the route so tapping Resource uploads/links doesn't close it.
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <Ctx.Provider
      value={{
        frontierKey: frontier,
        markSeen,
        canWrite,
        completed: courseCompleted,
        nextKey,
        dir: header?.dir ?? "ltr",
        contentLang: header?.lang ?? "en",
      }}
    >
      <div className="flex min-h-dvh flex-col md:h-screen md:flex-row md:overflow-hidden">
        {/* Mobile top bar: hamburger opens the lesson selector. Slides away on
            scroll-down for a fuller-screen read (useHideOnScroll). */}
        <header
          className={`sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-paper px-3 transition-transform duration-300 md:hidden ${
            navHidden ? "-translate-y-full" : "translate-y-0"
          }`}
        >
          <button onClick={() => setMenuOpen(true)} aria-label="Open lessons" className="rounded-lg p-1.5 text-ink hover:bg-hi">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="text-base font-semibold tracking-tight text-accent">{header?.title ?? "…"}</h1>
        </header>

        {menuOpen && <div onClick={() => setMenuOpen(false)} aria-hidden className="fixed inset-0 z-40 bg-black/40 md:hidden" />}

        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-72 transform flex-col overflow-y-auto border-r border-line bg-paper p-4 transition-transform duration-300 md:static md:z-auto md:w-64 md:translate-x-0 md:transition-none ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <Link
              href="/"
              className="-ml-1 flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
              aria-label="Back to courses"
            >
              <span aria-hidden>←</span> Courses
            </Link>
            <button
              onClick={() => void signOut().then(() => router.replace("/"))}
              className="shrink-0 text-xs text-soft hover:text-accent"
            >
              Sign out
            </button>
          </div>
          <h1 className="mb-4 truncate text-lg font-semibold tracking-tight text-accent">{header?.title ?? "…"}</h1>

          <nav className="flex flex-col gap-1">
            <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wider text-accent2">Lessons</p>
            {lessons?.length === 0 && (
              <p className="px-2 text-sm text-soft">{canWrite ? "Preparing your first lesson…" : "No lessons published yet."}</p>
            )}
            {lessons?.map((l) => (
              <NavItem
                key={l.key}
                href={withLang(`/courses/${slug}/lessons/${l.key}`, lang)}
                active={!isRef && activeKey === l.key}
                done={completed.has(l.key)}
                notify={unseenAnswers.has(l.key)}
                locked={preview && l.key !== previewKey}
                free={preview && l.key === previewKey}
              >
                {l.seq}. {l.title.split("—")[0]!.trim()}
              </NavItem>
            ))}

            <p className="px-2 pt-4 text-xs font-semibold uppercase tracking-wider text-accent2">References</p>
            {references?.map((r) => (
              <NavItem
                key={r.key}
                href={withLang(`/courses/${slug}/references/${r.key}`, lang)}
                active={isRef && activeKey === r.key}
                locked={preview}
              >
                {r.title}
              </NavItem>
            ))}

            <ResourcesSection topicSlug={slug} canWrite={canWrite} />
          </nav>

          {/* Owner-only "Course settings" (UI redesign): rename + mission, the
              certificate emblem (ADR 0017), and the completion lifecycle (ADR 0015)
              — the two buttons that used to crowd the nav — consolidated into one
              dialog. Absent for Viewers (PRD story 9), and while still `seeded` (a
              course that hasn't drafted a Lesson can't be completed). */}
          {canWrite && header && header.status !== "seeded" && (
            <CourseSettingsButton slug={slug} status={header.status} />
          )}

          {/* Edition switcher + theme toggle, pinned together at the sidebar
              bottom. The switcher is owner-only (a Viewer reads the single edition
              shared to them and can't change it — viewer-cannot-switch-edition) and
              only appears with more than one Edition (English + a ready translation). */}
          <div className="mt-auto flex flex-col gap-2 pt-2">
            {canWrite && header && header.editions.length > 1 && (
              <LanguageSwitcher editions={header.editions} current={header.lang} />
            )}
            <ThemeToggle />
          </div>
        </aside>

        <section className="min-w-0 flex-1 md:overflow-hidden md:p-4">{children}</section>
      </div>
      {/* Completion celebration (ADR 0015): fires once per device when the caller
          is newly eligible or just-earned on a completed course — owner or Viewer.
          Mounted once per course here (not per lesson), so it never re-triggers on
          lesson switches. */}
      {courseCompleted && <CompletionCelebration topicSlug={slug} />}
    </Ctx.Provider>
  );
}

// Light/Dark toggle pinned (with the Edition switcher) to the bottom of the
// sidebar (ADR 0011). The `mt-auto` that pins the group lives on the wrapper.
function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
    >
      <span>{dark ? "Dark" : "Light"} mode</span>
      <Icon name={dark ? "moon" : "sun"} className="h-4 w-4" />
    </button>
  );
}

// The Edition switcher (course-translation): swap the reader between the Editions
// the caller holds. Selecting one navigates the current page with `?lang=<code>`
// (English omits the param, keeping its URLs clean) and remembers the choice
// per-device, so reopening a course lands back in that language. Rendered next to
// ThemeToggle; only mounted when there's more than one Edition.
function LanguageSwitcher({
  editions,
  current,
}: {
  editions: { lang: string; name: string; native: string; rtl: boolean }[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm text-soft">
      <label htmlFor="edition-lang" className="shrink-0">Language</label>
      <select
        id="edition-lang"
        value={current}
        onChange={(e) => {
          const code = e.target.value;
          try {
            localStorage.setItem(LANG_KEY, code);
          } catch {
            /* storage disabled — the switch still applies for this session */
          }
          router.push(withLang(pathname, code));
        }}
        className="min-w-0 flex-1 rounded-md border border-line bg-card px-2 py-1 text-sm text-ink focus:border-gold focus:outline-none"
      >
        {editions.map((ed) => (
          <option key={ed.lang} value={ed.lang} dir={ed.rtl ? "rtl" : "ltr"}>
            {ed.native}
            {ed.rtl ? " (RTL)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

// Owner-only sidebar entry to the consolidated "Course settings" dialog (UI
// redesign): rename + mission, the certificate emblem, and the completion
// lifecycle (mark complete / reopen). Replaces the two full-width buttons that
// used to stack under the lesson nav. Gated by `canWrite` at the call site, so a
// Viewer never sees it.
function CourseSettingsButton({ slug, status }: { slug: string; status: "seeded" | "active" | "completed" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:border-transparent hover:bg-hi hover:text-accent"
      >
        <Icon name="settings" className="h-4 w-4" /> Course settings
      </button>
      {open && <CourseSettingsDialog topicSlug={slug} status={status} onClose={() => setOpen(false)} />}
    </>
  );
}

function NavItem({
  href,
  active,
  done = false,
  notify = false,
  locked = false,
  free = false,
  children,
}: {
  href: string;
  active: boolean;
  done?: boolean;
  notify?: boolean;
  // Paid marketplace: `locked` marks content past the free Preview (a lock icon,
  // muted label); `free` flags the Preview lesson itself. Both stay navigable —
  // opening a locked item shows the paygate, not a dead end.
  locked?: boolean;
  free?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors md:py-1.5 ${
        active ? "bg-accent text-white" : locked ? "text-soft hover:bg-hi" : "text-ink hover:bg-hi"
      }`}
    >
      <span className="min-w-0">{children}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        {free && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
              active ? "bg-white/20 text-white" : "bg-accent2/15 text-accent2"
            }`}
          >
            Free
          </span>
        )}
        {notify && (
          <span
            aria-label="New reply from your teacher"
            title="Your teacher answered a question here"
            className={`h-2 w-2 rounded-full ${active ? "bg-white" : "bg-gold"}`}
          />
        )}
        {done && (
          <span aria-label="completed" title="Completed" className={`text-xs ${active ? "text-white" : "text-accent2"}`}>
            ✓
          </span>
        )}
        {locked && (
          <Icon name="lock" className={`h-3.5 w-3.5 ${active ? "text-white" : "text-soft"}`} />
        )}
      </span>
    </Link>
  );
}

// The active Topic's Resources — files (PDF or Markdown, uploaded) and links —
// each opening in a new tab. Add more by uploading a file or pasting a link.
function ResourcesSection({ topicSlug, canWrite }: { topicSlug: string; canWrite: boolean }) {
  const resources = useQuery(api.resources.listResources, { topicSlug });
  const { uploadFile, addLink } = useResourceUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [adding, setAdding] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <details className="group mt-1">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-2 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-accent2 hover:text-accent [&::-webkit-details-marker]:hidden">
        Resources
        <svg
          aria-hidden
          className="mr-1 transition-transform duration-200 group-open:rotate-180"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="flex flex-col gap-1">
        {resources?.length === 0 && <p className="px-2 text-sm text-soft">No resources yet.</p>}
        {resources?.map((r) => (
          <ResourceItem key={r.id} resource={r} />
        ))}

        {/* Add controls are owner-only; a Viewer sees the list but can't add. */}
        {canWrite && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.md,.markdown,application/pdf,text/markdown"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void run(() => uploadFile(topicSlug, file));
              }}
            />
            {adding ? (
              <form
                className="mt-1 flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const link = linkDraft.trim();
                  if (!link) return;
                  setLinkDraft("");
                  setAdding(false);
                  void run(() => addLink(topicSlug, link));
                }}
              >
                <input
                  autoFocus
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  placeholder="https://…"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2 py-1 text-sm focus:border-gold focus:outline-none"
                />
                <button type="submit" className="rounded-lg bg-accent2 px-2 py-1 text-xs text-white">Add</button>
              </form>
            ) : (
              <div className="mt-1 flex gap-2">
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-dashed border-line px-2.5 py-2.5 text-left text-sm text-soft hover:bg-hi disabled:opacity-60 md:py-1.5"
                >
                  {busy ? "Working…" : "+ Upload file"}
                </button>
                <button
                  onClick={() => setAdding(true)}
                  disabled={busy}
                  className="rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-soft hover:bg-hi disabled:opacity-60 md:py-1.5"
                >
                  + Link
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}
