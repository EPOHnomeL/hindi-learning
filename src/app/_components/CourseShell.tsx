"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { CompletionCelebration, EmblemControl } from "./Certificate";
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
  const header = useQuery(api.content.courseHeader, { topicSlug: slug });
  const canWrite = header?.role === "owner";
  const courseCompleted = header?.status === "completed";
  const { signOut } = useAuthActions();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const navHidden = useHideOnScroll();

  const lessons = useQuery(api.content.listLessons, { topicSlug: slug });
  const references = useQuery(api.content.listReferences, { topicSlug: slug });
  const progress = useQuery(api.capture.myProgress, { topicSlug: slug });
  const questions = useQuery(api.capture.myQuestions, { topicSlug: slug });

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
    <Ctx.Provider value={{ frontierKey: frontier, markSeen, canWrite, completed: courseCompleted, nextKey }}>
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
                href={`/courses/${slug}/lessons/${l.key}`}
                active={!isRef && activeKey === l.key}
                done={completed.has(l.key)}
                notify={unseenAnswers.has(l.key)}
              >
                {l.seq}. {l.title.split("—")[0]!.trim()}
              </NavItem>
            ))}

            <p className="px-2 pt-4 text-xs font-semibold uppercase tracking-wider text-accent2">References</p>
            {references?.map((r) => (
              <NavItem key={r.key} href={`/courses/${slug}/references/${r.key}`} active={isRef && activeKey === r.key}>
                {r.title}
              </NavItem>
            ))}

            <ResourcesSection topicSlug={slug} canWrite={canWrite} />
          </nav>

          {/* Owner-only course lifecycle (ADR 0015): conclude the course, or reopen
              a completed one. Absent for Viewers (PRD story 9), and while still
              `seeded` — a course that hasn't drafted a Lesson can't be completed.
              The Emblem control (ADR 0017) sits alongside it: the owner curates the
              subject's mark on the certificate, overriding the automatic default. */}
          {canWrite && header && header.status !== "seeded" && (
            <>
              <EmblemControl topicSlug={slug} />
              <CompletionControls slug={slug} completed={courseCompleted} />
            </>
          )}

          <ThemeToggle />
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

// Light/Dark toggle pinned to the bottom of the sidebar (ADR 0011).
function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="mt-auto flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
    >
      <span>{dark ? "Dark" : "Light"} mode</span>
      <span aria-hidden className="text-base">{dark ? "☾" : "☀"}</span>
    </button>
  );
}

// Owner-only course lifecycle (ADR 0015). "Mark course complete" ends authoring —
// behind a confirmation, since it stops the Routine (PRD story 6); "Reopen course"
// returns a completed course to `active` so lessons generate again. Gated by
// `canWrite` at the call site, so a Viewer never sees either.
function CompletionControls({ slug, completed }: { slug: string; completed: boolean }) {
  const endCourse = useMutation(api.content.endCourse);
  const reopenCourse = useMutation(api.content.reopenCourse);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (completed) {
    return (
      <button
        onClick={() => {
          setBusy(true);
          void reopenCourse({ topicSlug: slug }).finally(() => setBusy(false));
        }}
        disabled={busy}
        className="mb-2 flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
      >
        ↻ Reopen course
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="mb-2 flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
      >
        ✓ Mark course complete
      </button>
      {confirming && (
        <ConfirmDialog
          title="Mark this course complete?"
          body="This ends the course — no more lessons will be generated. You can reopen it later if your goals grow."
          confirmLabel={busy ? "Ending…" : "Mark complete"}
          confirmDisabled={busy}
          onConfirm={() => {
            setBusy(true);
            void endCourse({ topicSlug: slug }).finally(() => {
              setBusy(false);
              setConfirming(false);
            });
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}

// A native <dialog> yes/no confirm — Esc, backdrop click, and focus-trap for
// free (ponytail: same pattern as ArtifactView's QaDialog / Dashboard's
// MissionDialog; extract to a shared module if a fourth use appears).
function ConfirmDialog({
  title,
  body,
  confirmLabel,
  confirmDisabled = false,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close(); // backdrop click
      }}
      className="m-auto w-[92vw] max-w-md rounded-2xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="px-6 py-5">
        <h2 className="text-base font-semibold text-accent">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-soft">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => ref.current?.close()} className="rounded-lg border border-line px-3 py-2 text-sm text-soft hover:bg-hi">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function NavItem({
  href,
  active,
  done = false,
  notify = false,
  children,
}: {
  href: string;
  active: boolean;
  done?: boolean;
  notify?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors md:py-1.5 ${
        active ? "bg-accent text-white" : "text-ink hover:bg-hi"
      }`}
    >
      <span className="min-w-0">{children}</span>
      <span className="flex shrink-0 items-center gap-1.5">
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
