"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Brand } from "./Brand";
import { CompletionCelebration } from "./Certificate";
import { Icon } from "./icons";
import { NavItem } from "./NavItem";
import { clearAccountLocalStateOnSignOut } from "./accountLocalState";
import { dragOffset, shouldDismiss } from "./drawerDrag";
import { ReadingLanguage } from "./ReadingLanguage";
import { useEditionLang, withLang } from "./editionUrl";
import { ResourceItem } from "./ResourceItem";
import { useTheme } from "./ThemeContext";
import { useHideOnScroll } from "./useHideOnScroll";
import { useResourceUpload } from "./useResourceUpload";
import { completedKeys, frontierKey, nextLessonKey, resumeLessonKey, seenAfterOpening } from "./readerDerive";
import { Welcome, useWelcomeDismissed } from "./Welcome";
import { latchFirstOpen, welcomeVariant } from "./welcomeDerive";

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
  // Whether the caller may make the in-place prose edits on the SERVED Edition
  // (ADR 0020): the owner, or an Editor of this language. Distinct from
  // `canWrite` — an Editor is a Viewer for everything else (quiz, questions,
  // authoring stay owner-only) but sees the hover-pencil. Server-computed;
  // defaults false while the header loads so the pencil never flashes.
  canEdit: boolean;
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
  const t = useTranslations("Reader");
  const tc = useTranslations("Common");
  const lang = useEditionLang();
  const header = useQuery(api.content.reader.courseHeader, { topicSlug: slug, lang: lang ?? undefined });
  const canWrite = header?.role === "owner";
  const canEdit = header?.canEdit ?? false;
  const courseCompleted = header?.status === "completed";
  const { signOut } = useAuthActions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The card buyer's return marker: PayFast sends them back with
  // `?purchase=return&mp=<intent token>`, carried through the CourseIndex redirect.
  const purchaseToken = searchParams.get("purchase") === "return" ? searchParams.get("mp") : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const navHidden = useHideOnScroll();
  // Swipe-to-dismiss on the mobile drawer (drawerDrag.ts): `drag` is how far the
  // sheet is currently pulled down (null when no finger is on the handle),
  // `dragFrom` the pointer-down Y it is measured from, and `drawerRef` supplies
  // the sheet's own height for the release threshold.
  const [drag, setDrag] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const lessons = useQuery(api.content.reader.listLessons, { topicSlug: slug, lang: lang ?? undefined });
  const references = useQuery(api.content.reader.listReferences, { topicSlug: slug, lang: lang ?? undefined });
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

  // Paid marketplace (ADR 0016): WHICH items are locked is the server's call —
  // `listLessons`/`listReferences` carry a per-item `locked` from the same rule
  // the body reads apply, so the nav never re-derives it from
  // `paywall.previewKey` (architecture-deepening/03). `preview` is only used to
  // decide whether the paygate is on show at all: it badges the one unlocked
  // Lesson "Free", which is meaningless to a caller who holds the Edition.
  const preview = header?.role === "preview";

  // The first-open welcome panel (welcome/01): shown when the caller has no
  // progress at all on this course *and* the course has lessons to orient them
  // around — a course still being generated gets no panel. Latched, because
  // rendering a lesson writes an `opened` row (ArtifactView) and progress is a live
  // query — an unlatched check would tear the panel away a beat after it appeared,
  // and on a brand-new course it would pop the panel open the moment lesson 1 lands.
  const [firstOpen, setFirstOpen] = useState<boolean | null>(null);
  // The payment acknowledgement gets its own dismissal scope, keyed on the intent
  // token (ywampotch-launch 17). Dismissal is per-tab-session, and buying happens
  // inside one session: a preview reader who dismissed the orientation panel before
  // clicking Unlock would otherwise come back from PayFast to a panel already
  // marked dismissed — the exact silence this ticket exists to end. One token, one
  // purchase, one dismissal.
  const [dismissed, dismiss] = useWelcomeDismissed(purchaseToken ? `${slug}:paid:${purchaseToken}` : slug);
  useEffect(() => {
    setFirstOpen((prev) => latchFirstOpen(prev, progress, lessons?.length));
  }, [progress, lessons]);

  const completed = completedKeys(progress ?? []);
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

  // The welcome panel's "start here" lesson: the caller's resume point, or — on a
  // paid Edition, where everything past the free Preview is locked — the first
  // lesson they can actually open. Never point at a door that won't open.
  const resumeKey = resumeLessonKey(lessons ?? [], progress ?? []);
  const startLesson =
    lessons?.find((l) => l.key === resumeKey && !l.locked) ?? lessons?.find((l) => !l.locked) ?? null;

  // Which nav item is active, read from the URL.
  const isRef = pathname.includes("/references/");
  const activeKey = decodeURIComponent(pathname.split("/").pop() ?? "");

  // The payment-return landing (ywampotch-launch 17): `checkoutStatus` is reactive
  // off the intent token, so an in-flight ITN resolves itself in place — no refresh.
  // Both payment states are variants of the welcome panel rather than a banner
  // beside it: one surface owns this moment. No timeout/failure branch (ponytail:
  // the verified norm is seconds; support owns the freak case).
  const checkout = useQuery(api.market.checkoutStatus, purchaseToken ? { mPaymentId: purchaseToken } : "skip");
  const variant = welcomeVariant({ purchaseToken, checkout, firstOpen, dismissed, onReference: isRef });

  // Selecting a Lesson/Reference navigates; close the mobile drawer when the route
  // changes. Keyed on the route so tapping Resource uploads/links doesn't close it.
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <Ctx.Provider
      value={{
        frontierKey: frontier,
        markSeen,
        canWrite,
        canEdit,
        completed: courseCompleted,
        nextKey,
        dir: header?.dir ?? "ltr",
        contentLang: header?.lang ?? "en",
      }}
    >
      <div className="flex min-h-dvh flex-col md:h-screen md:flex-row md:overflow-hidden">
        {/* Mobile top bar: hamburger opens the lesson selector. Slides away on
            scroll-down for a fuller-screen read (useHideOnScroll). The app tab
            bar's Home tab owns "back to the library" (mobile bottom nav,
            2026-08-23), so the old back arrow is a hamburger: both it and the
            course title open the lesson drawer. */}
        <header
          className={`sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-paper px-3 transition-transform duration-300 md:hidden ${
            navHidden ? "-translate-y-full" : "translate-y-0"
          }`}
        >
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={t("lessons")}
            aria-expanded={menuOpen}
            className="rounded-lg p-1.5 text-soft hover:bg-hi hover:text-accent"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-accent hover:text-accent/80 active:scale-98 transition-transform"
          >
            <span className="truncate max-w-[200px]">{header?.title ?? "…"}</span>
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

        {/* `pb-[5.75rem]` is the fix for the tail the app tab bar was eating
            (2026-08-24): the drawer is `fixed bottom-0`, the bar is a fixed
            4.75rem on top of it, so without that padding the last rows of the
            list (Resources, and whatever is pinned below it) were unreachable at
            any scroll position. A phone screenshot of it cut off is what
            reported this. `max-h-[80vh]` stays: the drawer is a sheet over the
            lesson, not a full-screen takeover.
            `style.transform` is the live drag (mobile only, while a finger is
            down); it beats the translate-y classes for exactly that moment. */}
        <aside
          ref={drawerRef}
          style={drag === null ? undefined : { transform: `translateY(${drag}px)`, transition: "none" }}
          className={`fixed bottom-0 inset-x-0 z-40 flex max-h-[80vh] transform flex-col overflow-y-auto overscroll-y-none border-t border-line rounded-t-2xl bg-paper p-4 pb-[5.75rem] transition-transform duration-300 md:static md:z-auto md:w-64 md:h-auto md:border-r md:border-t-0 md:rounded-t-none md:translate-y-0 md:translate-x-0 md:max-h-none md:p-4 md:transition-none ${
            menuOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          {/* Drawer handle for mobile. Draggable as it looks (2026-08-24): the
              handle used to be decoration, so pulling the sheet down did nothing
              and the only ways to shut it were the scrim and the hamburger. The
              pointer handlers live on this generous hit area rather than the
              whole aside, which is the scroll container for the lesson list. */}
          <div
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              dragFrom.current = e.clientY;
              setDrag(0);
            }}
            onPointerMove={(e) => {
              if (dragFrom.current === null) return;
              setDrag(dragOffset(dragFrom.current, e.clientY));
            }}
            onPointerUp={(e) => {
              if (dragFrom.current === null) return;
              const pulled = dragOffset(dragFrom.current, e.clientY);
              dragFrom.current = null;
              setDrag(null);
              if (shouldDismiss(pulled, drawerRef.current?.offsetHeight ?? 0)) setMenuOpen(false);
            }}
            onPointerCancel={() => {
              dragFrom.current = null;
              setDrag(null);
            }}
            className="-mt-1 mb-2.5 flex shrink-0 cursor-grab touch-none justify-center py-2 active:cursor-grabbing md:hidden"
          >
            <span aria-hidden className="h-1.5 w-12 rounded-full bg-line" />
          </div>

          {/* The brand lockup, mirroring PublicReader's sidebar (ywampotch-launch
              01). This was the last chrome surface with no brand mark at all: a
              tenant learner signed in off a branded landing page and read the
              course under an unbranded frame, immediately before being asked to
              pay. Desktop only since 2026-08-24: on a phone the drawer is the
              lesson list and nothing else, so the course title leads it and the
              tenant mark stays on the surfaces that have room for it. */}
          <Link
            href="/"
            aria-label={t("backToCoursesLabel")}
            title={t("backToCoursesLabel")}
            className="mb-3 hidden shrink-0 hover:opacity-80 md:block"
          >
            <Brand className="h-8 w-auto max-w-40 object-contain" />
          </Link>

          {/* Desktop only, same reasoning: on a phone, Home is a tab and Sign out
              lives on /settings, one tab away. */}
          <div className="mb-2 hidden items-center justify-between gap-2 md:flex">
            <Link
              href="/"
              className="hidden md:flex -ml-1 items-center gap-1 rounded-lg px-1.5 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
              aria-label={t("backToCoursesLabel")}
            >
              <span aria-hidden>←</span> {t("backToCourses")}
            </Link>
            <button
              onClick={() => {
                clearAccountLocalStateOnSignOut();
                void signOut().then(() => router.replace("/"));
              }}
              className="shrink-0 text-xs text-soft hover:text-accent ml-auto md:ml-0"
            >
              {tc("signOut")}
            </button>
          </div>
          {/* The served Edition's title. Fixing it (and the mission) lives in
              Course settings → Details, which follows the Edition being viewed
              (edition-title-edit 02). */}
          <h1 className="mb-4 truncate text-lg font-semibold tracking-tight text-accent">{header?.title ?? "…"}</h1>

          <nav className="flex flex-col gap-1">
            {/* The reading language, first thing in the list (2026-08-24). See
                ReadingLanguage for why it is here and not on the Home card. */}
            {header && header.editions.length > 1 && (
              <ReadingLanguage editions={header.editions} current={header.lang} />
            )}
            <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wider text-accent2">{t("lessons")}</p>
            {lessons?.length === 0 && (
              <p className="px-2 text-sm text-soft">{canWrite ? t("preparingFirstLesson") : t("noLessonsPublished")}</p>
            )}
            {lessons?.map((l) => (
              <NavItem
                key={l.key}
                href={withLang(`/courses/${slug}/lessons/${l.key}`, lang)}
                active={!isRef && activeKey === l.key}
                done={completed.has(l.key)}
                locked={l.locked}
                free={preview && !l.locked}
              >
                {l.seq}. {l.title.split("—")[0]!.trim()}
              </NavItem>
            ))}

            <p className="px-2 pt-4 text-xs font-semibold uppercase tracking-wider text-accent2">{t("references")}</p>
            {references?.map((r) => (
              <NavItem
                key={r.key}
                href={withLang(`/courses/${slug}/references/${r.key}`, lang)}
                active={isRef && activeKey === r.key}
                locked={r.locked}
              >
                {r.title}
              </NavItem>
            ))}

            <ResourcesSection topicSlug={slug} canWrite={canWrite} />
          </nav>

          {/* On a phone the drawer is the lesson list, the reading language and
              nothing else. Light/Dark is desktop-only here because on mobile it
              lives on /settings under Appearance (a tab away), and the Edition
              switcher that used to sit in this spot moved to the TOP of the nav
              above, where a thumb can actually reach it (2026-08-24). */}
          <div className="mt-auto hidden flex-col gap-2 pt-2 md:flex">
            <ThemeToggle />
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col md:overflow-hidden md:p-4">
          {/* The one panel that owns the opening moment (welcome/01, reshaped by
              ywampotch-launch 17): first-open orientation, or the card buyer's
              payment acknowledgement — `welcomeVariant` picks, and the purchase
              wins. Orientation is lessons-only (someone deep-linking to a Reference
              is looking something up); the acknowledgement isn't, because it's a
              receipt, not orientation. The portal link is a plain "/" here: this
              route's layout bounces to the course's canonical host (ADR 0022 §3),
              so "/" already IS its tenant's front door. (The Guest reader has no
              such bounce, hence tenantHomeHref there.) */}
          {variant && header && (
            <Welcome
              course={header.title}
              lessonCount={lessons?.length ?? 0}
              mission={header.mission}
              next={startLesson && { seq: startLesson.seq, title: startLesson.title, href: withLang(`/courses/${slug}/lessons/${startLesson.key}`, lang) }}
              homeHref="/"
              onDismiss={dismiss}
              purchase={variant === "first-open" ? null : { confirmed: variant === "purchase-complete" }}
            />
          )}
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </section>
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
  const tc = useTranslations("Common");
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={dark ? tc("themeToLight") : tc("themeToDark")}
      className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
    >
      <span>{dark ? tc("darkMode") : tc("lightMode")}</span>
      <Icon name={dark ? "moon" : "sun"} className="h-4 w-4" />
    </button>
  );
}

// The active Topic's Resources — files (PDF or Markdown, uploaded) and links —
// each opening in a new tab. Add more by uploading a file or pasting a link.
function ResourcesSection({ topicSlug, canWrite }: { topicSlug: string; canWrite: boolean }) {
  const t = useTranslations("Reader");
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
        {resources?.length === 0 && <p className="px-2 text-sm text-soft">{t("noResources")}</p>}
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
                  placeholder={t("linkPlaceholder")}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2 py-1 text-sm focus:border-gold focus:outline-none"
                />
                <button type="submit" className="rounded-lg bg-accent2 px-2 py-1 text-xs text-white">{t("add")}</button>
              </form>
            ) : (
              <div className="mt-1 flex gap-2">
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-dashed border-line px-2.5 py-2.5 text-left text-sm text-soft hover:bg-hi disabled:opacity-60 md:py-1.5"
                >
                  {busy ? t("working") : `+ ${t("uploadFile")}`}
                </button>
                <button
                  onClick={() => setAdding(true)}
                  disabled={busy}
                  className="rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-soft hover:bg-hi disabled:opacity-60 md:py-1.5"
                >
                  + {t("addLink")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}
