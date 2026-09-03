"use client";

import { useAction, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { ArtifactView } from "./ArtifactView";
import { useCourse } from "./CourseShell";
import { ReaderSkeleton } from "./ui";
import { LANG_KEY, useEditionLang } from "./editionUrl";
import { courseIndexRedirect, resumeLessonKey } from "./readerDerive";
import { SETUP_STAGES, formatElapsed, setupView } from "./setupProgress";

// The course index (`/courses/[slug]`): redirect to a Lesson so the URL always
// names what's shown (ADR 0012). Everyone — owner or Viewer — resumes at the
// lesson after their last completed one (open-to-last-completed), falling back
// to lesson 1 when nothing is completed yet. `replace`, not `push`, so "back"
// from the lesson goes to the dashboard rather than bouncing through here again.
export function CourseIndex({ slug }: { slug: string }) {
  const lang = useEditionLang();
  const locale = useLocale();
  const search = useSearchParams();
  const lessons = useQuery(api.content.reader.listLessons, { topicSlug: slug, lang: lang ?? undefined });
  const header = useQuery(api.content.reader.courseHeader, { topicSlug: slug, lang: lang ?? undefined });
  const progress = useQuery(api.capture.myProgress, { topicSlug: slug });
  const router = useRouter();

  // Wait for lessons, the header (for Edition resolution below), and progress
  // before choosing a target, so the caller lands on their resume point in one
  // hop rather than flashing through lesson 1 while progress loads.
  const target =
    lessons === undefined || header === undefined || progress === undefined
      ? null
      : resumeLessonKey(lessons, progress);

  useEffect(() => {
    if (!target) return;
    // Preserve the URL's Edition; failing that, open in the active UI language
    // when the course has that Edition; failing that, reopen in the last-used one
    // (per-device, an explicit prior switch) when the caller still holds it —
    // otherwise plain English.
    let effLang = lang;
    if (!effLang && header) {
      if (locale !== "en" && header.editions.some((e) => e.lang === locale)) {
        effLang = locale;
      } else {
        let stored: string | null = null;
        try {
          stored = localStorage.getItem(LANG_KEY);
        } catch {
          /* storage unavailable — fall through to English */
        }
        if (stored && stored !== "en" && header.editions.some((e) => e.lang === stored)) effLang = stored;
      }
    }
    // Carry the query string through (purchase/mp — the payment-return banner).
    router.replace(courseIndexRedirect(`/courses/${slug}/lessons/${target}`, search.toString(), effLang));
  }, [target, slug, router, lang, locale, header, search]);

  if (lessons === undefined) return <CourseStatus variant="loading" />;
  if (lessons.length === 0)
    return header?.role === "viewer" ? <CourseStatus variant="empty-viewer" /> : <CourseSetupPane slug={slug} />;
  return <CourseStatus variant="opening" />;
}

// The full-pane state shown before any Lesson exists, for the cases that are NOT
// an owner watching setup (that is CourseSetupPane below). A Viewer of a shared
// course with no lessons gets a calm "nothing yet"; the two resolving states mimic
// the lesson reader rather than flashing a bare line of centred text.
function CourseStatus({ variant }: { variant: "loading" | "opening" | "empty-viewer" }) {
  const t = useTranslations("Reader");
  if (variant === "loading" || variant === "opening") return <ReaderSkeleton />;

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-hi text-3xl" aria-hidden>
        📚
      </span>
      <h2 className="text-lg font-semibold text-accent">{t("noLessonsYet")}</h2>
      <p className="max-w-sm text-sm text-soft">{t("noLessonsYetBody")}</p>
    </div>
  );
}

// The setup pane: what a course's owner sits on between seeding it and Lesson 1
// landing. That wait is around ten minutes, which is the whole design problem —
// long enough that a spinner and one line of text reads as a broken page, so
// people reload, navigate away, or seed the course a second time.
//
// So this narrates the wait against the one true signal the backend has: the lock
// row's `startedAt`. Elapsed time is real; the stage names are an honest estimate
// of what a typical run is doing at that point (nothing reports back mid-run), and
// the copy says "usually about ten minutes" rather than implying live telemetry.
// All the arithmetic and state selection lives in `setupProgress` (tested); this
// component is its paint.
//
// It redirects itself away: `listLessons` in the parent is a live query, so the
// moment Lesson 1 is published the pane is replaced by the reader with no polling
// of its own.
function CourseSetupPane({ slug }: { slug: string }) {
  const t = useTranslations("Reader");
  const gen = useQuery(api.routine.generationStatus, { topicSlug: slug });
  const requestSetup = useAction(api.routine.requestSetup);
  const [restarting, setRestarting] = useState(false);

  // One second is the coarsest tick that still gives a moving counter. The clock
  // lives here rather than in the derive module so the maths stays pure and the
  // tests own time.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const view = setupView(gen, now);

  // Hold the reader skeleton until the lock row arrives, rather than painting a
  // pane whose whole shape then changes: an already-generating course would
  // otherwise flash the "Ready to set up" panel and its button for a beat.
  if (view.kind === "loading") return <ReaderSkeleton />;

  const restart = async () => {
    setRestarting(true);
    try {
      await requestSetup({ topicSlug: slug });
    } catch {
      // Best-effort, exactly as the dashboard's own "Set up now" is: the daily cron
      // remains the backstop, and the button re-enables so it can be tried again.
    } finally {
      setRestarting(false);
    }
  };

  const stageKey = view.kind === "working" || view.kind === "slow" ? SETUP_STAGES[view.stageIndex]!.key : null;

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="setup-card flex w-full max-w-lg flex-col items-center gap-6 rounded-2xl border border-line bg-card p-7 text-center shadow-sm sm:p-9">
        {/* The quill: a slow bob inside a breathing ring, so the pane is visibly
            alive across a ten-minute wait without anything darting about. Both
            animations are suppressed under prefers-reduced-motion (globals.css). */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="setup-halo absolute inset-0 rounded-full bg-gold/15" />
          <span className="setup-halo absolute inset-2 rounded-full bg-gold/20 [animation-delay:-1.2s]" />
          <span
            className="setup-quill relative flex h-16 w-16 items-center justify-center rounded-full bg-hi text-3xl shadow-sm"
            aria-hidden
          >
            {view.kind === "failed" ? "🪶" : "✍️"}
          </span>
        </div>

        {view.kind === "failed" ? (
          <>
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-accent">{t("setupFailedTitle")}</h2>
              <p className="text-sm leading-relaxed text-soft">{t("setupFailedBody")}</p>
              {view.error && (
                <p className="mt-1 max-w-sm break-words rounded-lg bg-hi/60 px-3 py-2 text-start text-xs text-soft">
                  {view.error}
                </p>
              )}
            </div>
            <RestartButton onClick={restart} busy={restarting} label={t("setupRestart")} />
          </>
        ) : view.kind === "queued" ? (
          <>
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-accent">{t("setupQueuedTitle")}</h2>
              <p className="max-w-sm text-sm leading-relaxed text-soft">{t("setupQueuedBody")}</p>
            </div>
            <RestartButton onClick={restart} busy={restarting} label={t("setupStartNow")} />
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-accent">{t("preparingFirstLessonTitle")}</h2>
              <p className="max-w-sm text-sm leading-relaxed text-soft">{t("preparingFirstLessonBody")}</p>
            </div>

            {/* The bar. `aria-live` sits on the stage line, not here: a percentage
                read out every second is noise, the stage changing is the news. */}
            <div className="w-full">
              <div className="relative h-2 overflow-hidden rounded-full bg-line">
                <div
                  className="setup-bar h-full rounded-full bg-gradient-to-r from-accent2 to-gold transition-[width] duration-1000 ease-linear"
                  style={{ width: `${view.percent}%` }}
                />
              </div>
              <div className="mt-2 flex items-baseline justify-between text-[11.5px] text-soft">
                <span className="tabular-nums">{formatElapsed(view.elapsedMs)}</span>
                <span>{view.kind === "slow" ? t("setupTakingLonger") : t("setupUsuallyTenMinutes")}</span>
              </div>
            </div>

            {/* The stages. Done ones tick and fade back, the live one is emphasised
                and pulses, later ones sit dim: the shape of the whole job stays
                visible, which is what makes a long wait legible. */}
            <ol className="flex w-full flex-col gap-2 text-start">
              {SETUP_STAGES.map((stage, i) => {
                const done = i < view.stageIndex;
                const live = i === view.stageIndex;
                return (
                  <li
                    key={stage.key}
                    className={`flex items-center gap-2.5 text-[13px] leading-snug transition-colors ${
                      live ? "font-semibold text-ink" : done ? "text-soft" : "text-soft/55"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        done
                          ? "bg-accent2/20 text-accent2"
                          : live
                            ? "setup-dot bg-gold/30 text-accent"
                            : "bg-line text-soft/60"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span>{t(`setupStage_${stage.key}`)}</span>
                  </li>
                );
              })}
            </ol>

            {/* The stage line is the accessible announcement of progress, and the
                only thing that changes rarely enough to be worth announcing. */}
            <p className="sr-only" aria-live="polite">
              {stageKey ? t(`setupStage_${stageKey}`) : ""}
            </p>

            <p className="text-xs leading-relaxed text-soft/80">{t("setupLeavePageSafe")}</p>

            {/* Only offered once the run is past the window the backend itself
                treats as stale, because that is the point where a fresh fire can
                actually take the lock. Offering it earlier would be a button that
                silently does nothing. */}
            {view.kind === "slow" && <RestartButton onClick={restart} busy={restarting} label={t("setupRestart")} />}
          </>
        )}
      </div>
    </div>
  );
}

function RestartButton({ onClick, busy, label }: { onClick: () => Promise<void>; busy: boolean; label: string }) {
  const t = useTranslations("Reader");
  return (
    <button
      onClick={() => void onClick()}
      disabled={busy}
      className="rounded-lg bg-gold/20 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-gold/30 disabled:opacity-70"
    >
      {busy ? t("setupStarting") : label}
    </button>
  );
}

// A single Lesson. Reads `frontierKey` from the course context for the
// "generate next lesson" affordance, and marks its replies seen on open.
export function LessonPane({ slug, lessonKey }: { slug: string; lessonKey: string }) {
  const { markSeen, frontierKey, canWrite, canEdit, completed, nextKey, dir, contentLang } = useCourse();
  useEffect(() => {
    markSeen(lessonKey);
  }, [lessonKey, markSeen]);
  return (
    <ArtifactView
      kind="lesson"
      artifactKey={lessonKey}
      topicSlug={slug}
      isFrontier={frontierKey === lessonKey}
      readOnly={!canWrite}
      canEdit={canEdit}
      courseCompleted={completed}
      nextLessonKey={nextKey(lessonKey)}
      dir={dir}
      contentLang={contentLang}
    />
  );
}

// A single Reference. Never the Frontier, nothing to mark seen.
export function ReferencePane({ slug, refKey }: { slug: string; refKey: string }) {
  const { canWrite, canEdit, dir, contentLang } = useCourse();
  return (
    <ArtifactView
      kind="reference"
      artifactKey={refKey}
      topicSlug={slug}
      isFrontier={false}
      readOnly={!canWrite}
      canEdit={canEdit}
      dir={dir}
      contentLang={contentLang}
    />
  );
}
