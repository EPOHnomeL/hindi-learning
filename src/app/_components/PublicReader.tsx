"use client";

import { useQuery } from "convex/react";
import { type FunctionReturnType } from "convex/server";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Frame } from "./ArtifactView";
import { Markdown } from "./MarkdownView";
import { ResourceItem } from "./ResourceItem";
import { useTheme } from "./ThemeContext";
import { firstLessonKey, nextLessonKey } from "./readerDerive";

// The Guest reader (issue 07 / ADR 0013): the read-only `/share/[token]` view an
// anonymous Guest sees. It mirrors the authed reader's shape but reaches data
// through the token (api.public.*), shows no write controls, and has no auth
// chrome (no sign-out, no "Courses"). The lesson iframe stays interactive so a
// Guest can self-check quizzes; nothing is recorded.

type GuestCourse = NonNullable<FunctionReturnType<typeof api.public.publicCourse>>;

// The course bundle + token, fetched once in the layout and read by the panes.
const Ctx = createContext<{ token: string; course: GuestCourse } | null>(null);
function useGuestCourse() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGuestCourse must be used within PublicCourseShell");
  return c;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <p className="p-8 text-center text-soft">{children}</p>;
}

// The persistent sidebar + pane shell, fixed by the URL token. Fetches the
// course bundle once; an unknown/revoked token renders a friendly dead-end.
export function PublicCourseShell({ token, children }: { token: string; children: React.ReactNode }) {
  const course = useQuery(api.public.publicCourse, { token });
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);

  if (course === undefined) return <Centered>Loading…</Centered>;
  if (course === null) return <Centered>This link isn’t available — the owner may have turned it off.</Centered>;

  const isRef = pathname.includes("/references/");
  const activeKey = decodeURIComponent(pathname.split("/").pop() ?? "");
  const base = `/share/${token}`;

  return (
    <Ctx.Provider value={{ token, course }}>
      <div className="flex min-h-dvh flex-col md:h-screen md:flex-row md:overflow-hidden">
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-paper px-3 md:hidden">
          <button onClick={() => setMenuOpen(true)} aria-label="Open lessons" className="rounded-lg p-1.5 text-ink hover:bg-hi">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="text-base font-semibold tracking-tight text-accent">{course.title}</h1>
        </header>

        {menuOpen && <div onClick={() => setMenuOpen(false)} aria-hidden className="fixed inset-0 z-40 bg-black/40 md:hidden" />}

        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-72 transform flex-col overflow-y-auto border-r border-line bg-paper p-4 transition-transform duration-300 md:static md:z-auto md:w-64 md:translate-x-0 md:transition-none ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-accent2">Public course</p>
          <h1 className="mb-4 truncate text-lg font-semibold tracking-tight text-accent">{course.title}</h1>

          <nav className="flex flex-col gap-1">
            <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wider text-accent2">Lessons</p>
            {course.lessons.length === 0 && <p className="px-2 text-sm text-soft">No lessons published yet.</p>}
            {course.lessons.map((l) => (
              <NavItem key={l.key} href={`${base}/lessons/${l.key}`} active={!isRef && activeKey === l.key}>
                {l.seq}. {l.title.split("—")[0]!.trim()}
              </NavItem>
            ))}

            {course.references.length > 0 && (
              <p className="px-2 pt-4 text-xs font-semibold uppercase tracking-wider text-accent2">References</p>
            )}
            {course.references.map((r) => (
              <NavItem key={r.key} href={`${base}/references/${r.key}`} active={isRef && activeKey === r.key}>
                {r.title}
              </NavItem>
            ))}

            {course.resources.length > 0 && (
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
                  {course.resources.map((r) => (
                    <ResourceItem key={r.id} resource={r} />
                  ))}
                </div>
              </details>
            )}
          </nav>

          <ThemeToggle />
        </aside>

        <section className="min-w-0 flex-1 md:overflow-hidden md:p-4">{children}</section>
      </div>
    </Ctx.Provider>
  );
}

function NavItem({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors md:py-1.5 ${
        active ? "bg-accent text-white" : "text-ink hover:bg-hi"
      }`}
    >
      {children}
    </Link>
  );
}

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

// `/share/[token]` — redirect to the first Lesson, mirroring CourseIndex.
export function PublicCourseIndex({ token }: { token: string }) {
  const course = useQuery(api.public.publicCourse, { token });
  const router = useRouter();
  const first = course ? firstLessonKey(course.lessons) : null;
  useEffect(() => {
    if (first) router.replace(`/share/${token}/lessons/${first}`);
  }, [first, token, router]);

  if (course === undefined) return <Centered>Loading…</Centered>;
  if (course === null) return <Centered>This link isn’t available — the owner may have turned it off.</Centered>;
  if (course.lessons.length === 0) return <Centered>No lessons published yet.</Centered>;
  return <Centered>Opening…</Centered>;
}

export function PublicLessonPane({ token, lessonKey }: { token: string; lessonKey: string }) {
  const { theme } = useTheme();
  const { course } = useGuestCourse();
  const lesson = useQuery(api.public.publicLesson, { token, key: lessonKey });
  const qa = course.questions.filter((q) => q.lessonKey === lessonKey);
  const next = nextLessonKey(course.lessons, lessonKey);

  if (lesson === undefined) return <p className="text-soft">Loading…</p>;
  if (lesson === null) return <p className="text-soft">Lesson not found.</p>;

  return (
    <div className="flex flex-col gap-4 md:h-full md:flex-row">
      <div className="flex min-h-0 flex-1 flex-col gap-0 md:gap-3">
        <div className="sticky top-12 z-20 flex items-center justify-between gap-3 border-b border-line bg-paper px-3 py-2 md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0">
          <h2 className="min-w-0 truncate text-lg font-semibold">{lesson.title}</h2>
          {next && (
            <Link
              href={`/share/${token}/lessons/${next}`}
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent/90"
            >
              Next lesson →
            </Link>
          )}
        </div>
        {/* Quizzes stay interactive (self-check); nothing is recorded for a Guest. */}
        <Frame html={lesson.html} withBridge theme={theme} />
        <div className="p-3 md:hidden">
          <GuestQuestions qa={qa} />
        </div>
      </div>
      <aside className="hidden shrink-0 md:block md:w-80 md:overflow-y-auto">
        <GuestQuestions qa={qa} />
      </aside>
    </div>
  );
}

// The owner's Questions + Replies for this lesson, read-only (no ask form).
function GuestQuestions({ qa }: { qa: GuestCourse["questions"] }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4 md:flex md:h-full md:flex-col">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent2">Questions &amp; replies</h3>
      {qa.length === 0 && <p className="text-sm text-soft">No questions on this lesson yet.</p>}
      <ul className="mt-1 flex flex-col gap-3 md:min-h-0 md:flex-1 md:overflow-y-auto">
        {qa.map((q) => (
          <li key={q.id} className="text-sm">
            <p className="font-medium text-ink">{q.text}</p>
            {q.reply ? (
              <div className="mt-1.5 rounded-lg border-l-2 border-accent2 bg-hi px-3 py-2">
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent2">Teacher</p>
                <Markdown source={q.reply} className="flex flex-col gap-2 text-sm leading-relaxed text-ink" />
              </div>
            ) : (
              <p className="mt-1 text-xs text-soft">Not yet answered.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PublicReferencePane({ token, refKey }: { token: string; refKey: string }) {
  const { theme } = useTheme();
  const ref = useQuery(api.public.publicReference, { token, key: refKey });
  if (ref === undefined) return <p className="text-soft">Loading…</p>;
  if (ref === null) return <p className="text-soft">Reference not found.</p>;
  return (
    <div className="flex flex-col gap-0 md:h-full md:gap-3">
      <h2 className="sticky top-12 z-20 truncate border-b border-line bg-paper px-3 py-2 text-lg font-semibold md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0">{ref.title}</h2>
      <Frame html={ref.html} withBridge={false} theme={theme} themeCss />
    </div>
  );
}
