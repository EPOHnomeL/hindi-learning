"use client";

import { Authenticated } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { Icon } from "./icons";
import { useHideOnScroll } from "./useHideOnScroll";

// The app-level bottom tab bar, mobile only: Home, Course (the resume point),
// Settings, plus Admin for an admin. Mounted in the root layout so it is present
// on Home, in the reader and on the admin portal alike; the reader keeps its own
// top bar and lesson drawer underneath it. Decided 2026-08-23 (variant D of the
// mobile bottom-nav prototype); the full record, including the rejected
// variants and tab-naming shortlist, lives in
// .plan/maps/ui-overhaul/assets/mobile-bottom-nav.md.
export function AppTabs() {
  return (
    <Authenticated>
      <Tabs />
    </Authenticated>
  );
}

// Lesson titles are stored as "Title <em dash> subtitle"; the nav shows the
// head, mirroring CourseShell's sidebar rows.
const TITLE_SEP = String.fromCharCode(8212);

function Tabs() {
  const t = useTranslations("Tabs");
  const pathname = usePathname() ?? "/";
  const navHidden = useHideOnScroll();

  const scope = useQuery(api.whitelist.myAdminScope);
  const isAdmin = !!scope && scope.role !== "none";

  // The learner's server-side resume point: the most recent progress row across
  // all their topics (capture.myLastRead), so Continue survives devices. The
  // href carries no ?lang on purpose: absent means "no preference" and the
  // backend serves a held Edition (editionUrl.ts header note).
  const last = useQuery(api.capture.myLastRead);
  const header = useQuery(api.content.reader.courseHeader, last ? { topicSlug: last.topicSlug } : "skip");
  const lessons = useQuery(api.content.reader.listLessons, last ? { topicSlug: last.topicSlug } : "skip");
  const lesson = last ? lessons?.find((l) => l.key === last.lessonKey) : undefined;

  // `onCourse` also gates the auto-hide below: scrolling down inside a course
  // tucks this bar away with the reader's own top bar (useHideOnScroll), and
  // scrolling up brings both back. On a phone the bar is a fixed 4.75rem, a tenth
  // of the screen spent on navigation while somebody is reading a lesson they
  // scrolled to on purpose. Only in the reader. Everywhere else (Home, Settings,
  // admin) the bar is the way around the app and stays put.
  const onCourse = pathname.startsWith("/courses/");
  const onAdmin = pathname.startsWith("/admin");
  const onSettings = pathname.startsWith("/settings");
  const onHome = pathname === "/";
  // `undefined` while `myLastRead` is still loading OR when there is no resume
  // point at all; either way there is nowhere for Course to go, and the tab is
  // rendered inert rather than as a dimmed link to Home (fluid-interface 08,
  // 2026-09-18: a link to "/" lit Home and Course at once, with opacity as the
  // only thing telling them apart).
  const continueHref = last ? `/courses/${last.topicSlug}/lessons/${last.lessonKey}` : undefined;

  return (
    <>
      {/* Mounted after {children} in the root layout, so this spacer sits at the
          end of the document flow and keeps the fixed bar off the last row of
          every page. */}
      <div aria-hidden className="h-[4.75rem] md:hidden" />

      {/* The resume card. Only on Home, because that is the one screen with room
          for it and the one place the learner arrives cold. Inside a course they
          are already reading, so Course is just an active tab there. */}
      {onHome && last && (
        <Link
          href={`/courses/${last.topicSlug}/lessons/${last.lessonKey}`}
          className="chrome chrome--card chrome--solid fixed inset-x-3 bottom-[4.75rem] z-40 flex items-center gap-3 rounded-2xl px-3 py-2.5 shadow-lg md:hidden"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-hi text-sm font-bold text-accent">
            {lesson?.seq ?? "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.625rem] font-semibold uppercase tracking-wider text-accent2">
              {t("pickUp")}
            </span>
            <span className="block truncate text-sm font-semibold text-ink">
              {lesson ? lesson.title.split(TITLE_SEP)[0]!.trim() : (header?.title ?? "…")}
            </span>
          </span>
          <PlayIcon />
        </Link>
      )}

      <nav
        // Reduced motion (fluid-interface 05): the bar cross-fades instead of
        // sliding. `motion-reduce:transition-opacity` retargets the transition,
        // `motion-reduce:translate-y-0` cancels the slide and the hidden branch
        // fades out, with pointer events off so an invisible bar eats no taps.
        // `chrome--solid` (2026-09-18): the tab bar is the one surface that is up
        // on every screen, so lesson text sliding about behind it read as noise
        // rather than depth. It keeps the hairline and loses the see-through.
        className={`chrome chrome--solid fixed inset-x-0 bottom-0 z-50 grid h-[4.75rem] pb-[env(safe-area-inset-bottom)] transition-transform duration-300 motion-reduce:translate-y-0 motion-reduce:transition-opacity md:hidden ${
          isAdmin ? "grid-cols-4" : "grid-cols-3"
        } ${navHidden && onCourse ? "translate-y-full motion-reduce:pointer-events-none motion-reduce:opacity-0" : "translate-y-0"}`}
      >
        <Tab href="/" active={onHome} label={t("home")} icon={<HomeIcon />} />
        {/* "Course", not "Continue": the other tabs are places, so a verb here
            read as the odd one out. It still resumes; the resume card on Home
            spells that out in the words a 10px tab label has no room for.
            Icon: a document. The folded corner makes it read as a page, and two
            interior lines are the whole interior: three go to mush at 20px. */}
        <Tab href={continueHref} active={onCourse} label={t("course")} icon={<DocIcon />} />
        <Tab
          href="/settings"
          active={onSettings}
          label={t("settings")}
          icon={<Icon name="settings" className="h-5 w-5" />}
        />
        {isAdmin && (
          <Tab href="/admin" active={onAdmin} label={t("admin")} icon={<Icon name="users" className="h-5 w-5" />} />
        )}
      </nav>
    </>
  );
}

// No `href` means there is nowhere to go: the tab renders as a `span` that is
// `aria-disabled`, out of the tab order and inert to pointers, keeping its label
// and icon so the bar still reads as three places rather than shifting about.
function Tab({
  href,
  active,
  label,
  icon,
}: {
  href?: string;
  active: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  // `press`: the base press rule in globals.css (fluid-interface 02), since a
  // Link is not a button; the tab also recolours on press, not only by route.
  const shared = "flex flex-col items-center justify-center gap-1 text-[0.625rem] font-medium transition duration-100";
  if (!href) {
    return (
      <span aria-disabled="true" tabIndex={-1} className={`${shared} pointer-events-none text-soft/50`}>
        {icon}
        {label}
      </span>
    );
  }
  return (
    <Link href={href} className={`press ${shared} active:text-accent ${active ? "text-accent" : "text-soft"}`}>
      {icon}
      {label}
    </Link>
  );
}

function HomeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13.5h6" />
      <path d="M9 17h4" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}
