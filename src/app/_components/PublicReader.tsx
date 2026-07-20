"use client";

import { useQuery } from "convex/react";
import { type FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { langInfo } from "../../../convex/languages";
import { Frame, useCardTarget, useContentHtml } from "./ArtifactView";
import { NavItem } from "./NavItem";
import { Markdown } from "./MarkdownView";
import { LockedPane, Paygate } from "./Paygate";
import { ResourceItem } from "./ResourceItem";
import { useTheme } from "./ThemeContext";
import { CourseSkeleton, ReaderSkeleton } from "./ui";
import { useHideOnScroll } from "./useHideOnScroll";
import { firstLessonKey, nextLessonKey } from "./readerDerive";

// The Guest reader (issue 07 / ADR 0013): the read-only `/share/[token]` view an
// anonymous Guest sees. It mirrors the authed reader's shape but reaches data
// through the token (api.public.*), shows no write controls, and has no auth
// chrome (no sign-out, no "Courses"). The lesson iframe stays interactive so a
// Guest can self-check quizzes; nothing is recorded.

type GuestCourse = NonNullable<FunctionReturnType<typeof api.public.publicCourse>>;

// A Guest has no account, so their Progress can't be stored server-side. Instead
// the sidebar's ✓ ticks live in localStorage, per device and per Public link
// token, and are set when the Guest presses "Next lesson".
const DONE_KEY = "hindi:guest-done";

// The course bundle + token, plus the Guest's per-device completed set, fetched/
// loaded once in the layout and read by the panes.
type GuestCtx = {
  token: string;
  course: GuestCourse;
  completed: ReadonlySet<string>;
  markComplete: (lessonKey: string) => void;
};
const Ctx = createContext<GuestCtx | null>(null);
function useGuestCourse() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGuestCourse must be used within PublicCourseShell");
  return c;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <p className="p-8 text-center text-soft">{children}</p>;
}

// Buy on a Public link routes into the authed app (auth-first, ADR 0021): the
// SAME Lesson/Reference under /courses, carrying the Edition and a `buy` marker.
// Signed out, that URL renders SignIn (defaulting to "Create account"); signed
// in, it lands on the locked page with the buy dialog open.
function buyLink(slug: string, kind: "lessons" | "references", key: string, lang: string): string {
  const params = new URLSearchParams({ buy: "1" });
  if (lang !== "en") params.set("lang", lang);
  return `/courses/${slug}/${kind}/${key}?${params.toString()}`;
}

// The persistent sidebar + pane shell, fixed by the URL token. Fetches the
// course bundle once; an unknown/revoked token renders a friendly dead-end.
export function PublicCourseShell({ token, children }: { token: string; children: React.ReactNode }) {
  const t = useTranslations("Reader");
  const course = useQuery(api.public.publicCourse, { token });
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const navHidden = useHideOnScroll();
  useEffect(() => setMenuOpen(false), [pathname]);

  // The Guest's completed lessons (per device, per token). Loaded from localStorage
  // on mount; `markComplete` adds one and persists. No account, so this is all
  // client-side.
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${DONE_KEY}:${token}`);
      if (raw) setCompleted(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* unavailable or corrupt storage — start empty */
    }
  }, [token]);
  const markComplete = useCallback(
    (lessonKey: string) => {
      setCompleted((prev) => {
        if (prev.has(lessonKey)) return prev;
        const next = new Set(prev).add(lessonKey);
        try {
          localStorage.setItem(`${DONE_KEY}:${token}`, JSON.stringify([...next]));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [token],
  );

  if (course === undefined) return <CourseSkeleton />;
  if (course === null) return <Centered>{t("linkUnavailable")}</Centered>;

  const isRef = pathname.includes("/references/");
  const activeKey = decodeURIComponent(pathname.split("/").pop() ?? "");
  const base = `/share/${token}`;

  // Paid marketplace (ADR 0016): a Public link to a PAID Edition serves a Guest
  // only the free Preview + the table of contents (`publicCourse.paywall` is
  // present). Everything past the Preview is locked in the nav; the Preview Lesson
  // itself is flagged Free. A free Edition has no paywall and reads as before.
  const preview = !!course.paywall;
  const previewKey = course.paywall?.previewKey ?? null;

  return (
    <Ctx.Provider value={{ token, course, completed, markComplete }}>
      <div className="flex min-h-dvh flex-col md:h-screen md:flex-row md:overflow-hidden">
        <header
          className={`sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-paper px-3 transition-transform duration-300 md:hidden ${
            navHidden ? "-translate-y-full" : "translate-y-0"
          }`}
        >
          <Link
            href="/"
            aria-label={t("backToCoursesLabel") ?? "Back to courses"}
            title={t("backToCoursesLabel") ?? "Back to courses"}
            className="rounded-lg p-1.5 text-soft hover:bg-hi hover:text-accent"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-accent hover:text-accent/80 active:scale-98 transition-transform"
          >
            <span className="truncate max-w-[200px]">{course.title}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </header>

        {menuOpen && <div onClick={() => setMenuOpen(false)} aria-hidden className="fixed inset-0 z-30 bg-black/40 md:hidden" />}

        <aside
          className={`fixed bottom-0 inset-x-0 z-40 flex max-h-[80vh] transform flex-col overflow-y-auto border-t border-line rounded-t-2xl bg-paper p-4 transition-transform duration-300 md:static md:z-auto md:w-64 md:h-auto md:border-r md:border-t-0 md:rounded-t-none md:translate-y-0 md:translate-x-0 md:max-h-none md:transition-none ${
            menuOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          {/* Drawer handle for mobile */}
          <div className="mx-auto mb-3.5 h-1.5 w-12 shrink-0 rounded-full bg-line md:hidden" />
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-accent2">{t("publicCourse")}</p>
          <div className="mb-4">
            <h1 className="truncate text-lg font-semibold tracking-tight text-accent">{course.title}</h1>
            {/* The Edition this token serves (course-translation). A Guest holds the
                one language their link is for — no switcher, just a small label. */}
            {course.lang !== "en" && (
              <p className="mt-0.5 text-xs text-soft" dir={course.dir}>
                {langInfo(course.lang).native}
              </p>
            )}
          </div>

          <nav className="flex flex-col gap-1">
            <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wider text-accent2">{t("lessons")}</p>
            {course.lessons.length === 0 && <p className="px-2 text-sm text-soft">{t("noLessonsPublished")}</p>}
            {course.lessons.map((l) => (
              <NavItem
                key={l.key}
                href={`${base}/lessons/${l.key}`}
                active={!isRef && activeKey === l.key}
                done={completed.has(l.key)}
                locked={preview && l.key !== previewKey}
                free={preview && l.key === previewKey}
              >
                {l.seq}. {l.title.split("—")[0]!.trim()}
              </NavItem>
            ))}

            {course.references.length > 0 && (
              <p className="px-2 pt-4 text-xs font-semibold uppercase tracking-wider text-accent2">{t("references")}</p>
            )}
            {course.references.map((r) => (
              <NavItem key={r.key} href={`${base}/references/${r.key}`} active={isRef && activeKey === r.key} locked={preview}>
                {r.title}
              </NavItem>
            ))}

            {course.resources.length > 0 && (
              <details className="group mt-1">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-2 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-accent2 hover:text-accent [&::-webkit-details-marker]:hidden">
                  {t("resources")}
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

function ThemeToggle() {
  const tc = useTranslations("Common");
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={dark ? tc("themeToLight") : tc("themeToDark")}
      className="mt-auto flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
    >
      <span>{dark ? tc("darkMode") : tc("lightMode")}</span>
      <span aria-hidden className="text-base">{dark ? "☾" : "☀"}</span>
    </button>
  );
}

// `/share/[token]` — redirect to the first Lesson, mirroring CourseIndex.
export function PublicCourseIndex({ token }: { token: string }) {
  const t = useTranslations("Reader");
  const course = useQuery(api.public.publicCourse, { token });
  const router = useRouter();
  const first = course ? firstLessonKey(course.lessons) : null;
  useEffect(() => {
    if (first) router.replace(`/share/${token}/lessons/${first}`);
  }, [first, token, router]);

  if (course === undefined) return <ReaderSkeleton />;
  if (course === null) return <Centered>{t("linkUnavailable")}</Centered>;
  if (course.lessons.length === 0) return <Centered>{t("noLessonsPublished")}</Centered>;
  // Redirecting straight into a Lesson — mimic the reader, not a bare line.
  return <ReaderSkeleton />;
}

export function PublicLessonPane({ token, lessonKey }: { token: string; lessonKey: string }) {
  const t = useTranslations("Reader");
  const { theme } = useTheme();
  const navHidden = useHideOnScroll();
  const { course, markComplete } = useGuestCourse();
  const lesson = useQuery(api.public.publicLesson, { token, key: lessonKey });
  const html = useContentHtml(lesson);
  const qa = course.questions.filter((q) => q.lessonKey === lessonKey);
  const next = nextLessonKey(course.lessons, lessonKey);

  if (lesson === undefined || html === undefined) return <ReaderSkeleton />;
  if (lesson === null) return <p className="text-soft">{t("lessonNotFound")}</p>;
  if (html === null) return <p className="text-soft">{t("loadLessonFailed")}</p>;

  // Paid marketplace: on a paid Edition's Public link a Guest gets the paygate for
  // every Lesson past the free Preview (the reader returns `locked`).
  const editionName = course.lang !== "en" ? langInfo(course.lang).native : undefined;
  if (lesson.locked) {
    return (
      <LockedPane title={lesson.title}>
        <Paygate
          kind="lesson"
          paywall={course.paywall ?? null}
          courseTitle={course.title}
          editionName={editionName}
          buyHref={buyLink(course.slug, "lessons", lessonKey, course.lang)}
        />
      </LockedPane>
    );
  }
  const preview = !!course.paywall;

  return (
    <div className="flex flex-col gap-4 md:h-full md:flex-row">
      <div className="flex min-h-0 flex-1 flex-col gap-0 md:gap-3">
        <div
          className={`sticky z-20 flex items-center justify-between gap-3 border-b border-line bg-paper px-3 py-2 transition-[top] duration-300 md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0 ${
            navHidden ? "top-0" : "top-12"
          }`}
        >
          <h2 className="min-w-0 truncate text-lg font-semibold">{lesson.title}</h2>
          {next && (
            <Link
              href={`/share/${token}/lessons/${next}`}
              onClick={() => markComplete(lessonKey)}
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent/90"
            >
              {t("nextLesson")} →
            </Link>
          )}
        </div>
        {/* Quizzes stay interactive (self-check); nothing is recorded for a Guest.
            Resource links open from the in-bundle list (rich-media/11); a paid
            Preview withholds Resources, so those links no-op. */}
        <Frame html={html} withBridge theme={theme} dir={course.dir} lang={course.lang} resources={course.resources} />
        {/* Q&A sits past the paygate — withheld from a paid-Edition Guest. */}
        {!preview && (
          <div className="p-3 md:hidden">
            <GuestQuestions qa={qa} />
          </div>
        )}
      </div>
      {!preview && (
        <aside className="hidden shrink-0 md:block md:w-80 md:overflow-y-auto">
          <GuestQuestions qa={qa} />
        </aside>
      )}
    </div>
  );
}

// The owner's Questions + Replies for this lesson, read-only (no ask form).
function GuestQuestions({ qa }: { qa: GuestCourse["questions"] }) {
  const t = useTranslations("Reader");
  return (
    <div className="rounded-xl border border-line bg-card p-4 md:flex md:h-full md:flex-col">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent2">{t("questionsAndReplies")}</h3>
      {qa.length === 0 && <p className="text-sm text-soft">{t("noQuestions")}</p>}
      <ul className="mt-1 flex flex-col gap-3 md:min-h-0 md:flex-1 md:overflow-y-auto">
        {qa.map((q) => (
          <li key={q.id} className="text-sm">
            <p className="font-medium text-ink">{q.text}</p>
            {q.reply ? (
              <div className="mt-1.5 rounded-lg border-l-2 border-accent2 bg-hi px-3 py-2">
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent2">{t("teacher")}</p>
                <Markdown source={q.reply} className="flex flex-col gap-2 text-sm leading-relaxed text-ink" />
              </div>
            ) : (
              <p className="mt-1 text-xs text-soft">{t("notYetAnswered")}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PublicReferencePane({ token, refKey }: { token: string; refKey: string }) {
  const t = useTranslations("Reader");
  const { theme } = useTheme();
  const { course } = useGuestCourse();
  const navHidden = useHideOnScroll();
  const ref = useQuery(api.public.publicReference, { token, key: refKey });
  const html = useContentHtml(ref);
  const cardTarget = useCardTarget(refKey);
  // A Guest is already on the course's public page, so the card share always has a
  // destination (reference-cards/03): the `/share/<token>` landing on this host.
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/share/${token}` : null;
  const share = shareUrl ? { courseTitle: course.title, url: shareUrl } : null;
  if (ref === undefined || html === undefined) return <ReaderSkeleton aside={false} />;
  if (ref === null) return <p className="text-soft">{t("referenceNotFound")}</p>;
  if (html === null) return <p className="text-soft">{t("loadReferenceFailed")}</p>;
  // Paid marketplace: References sit past the free Preview — the paygate for a
  // Guest on a paid Edition (a locked body is served as html:"" so it reaches here).
  if (ref.locked) {
    return (
      <LockedPane title={ref.title}>
        <Paygate
          kind="reference"
          paywall={course.paywall ?? null}
          courseTitle={course.title}
          editionName={course.lang !== "en" ? langInfo(course.lang).native : undefined}
          buyHref={buyLink(course.slug, "references", refKey, course.lang)}
        />
      </LockedPane>
    );
  }
  return (
    <div className="flex flex-col gap-0 md:h-full md:gap-3">
      <h2
        className={`sticky z-20 truncate border-b border-line bg-paper px-3 py-2 text-lg font-semibold transition-[top] duration-300 md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0 ${
          navHidden ? "top-0" : "top-12"
        }`}
      >
        {ref.title}
      </h2>
      <Frame html={html} withBridge={false} theme={theme} themeCss dir={course.dir} lang={course.lang} resources={course.resources} reference cardTarget={cardTarget} share={share} />
    </div>
  );
}
