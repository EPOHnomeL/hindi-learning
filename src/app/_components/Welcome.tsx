"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon } from "./icons";
import { useTenant } from "./TenantContext";
import { IconButton } from "./ui";
import { missionExcerpt } from "./welcomeDerive";

// The first-open welcome panel (welcome/01). Someone's first contact with a course
// is a lesson — they open one for the first time, or they arrive cold on a Public
// link — and the reader otherwise drops them straight into lesson content with no
// orientation. This says what the course is, how long it is, and which lesson to
// start on, plus a way back to the brand's front door.
//
// Deliberately an inline card above the lesson, not a modal: a Guest must never be
// trapped behind a dialog to read a page they were linked to, and the lesson stays
// readable without dismissing anything. Rendered by both readers (CourseShell and
// PublicReader) so the two stay in step.
export function Welcome({
  course,
  lessonCount,
  mission,
  next,
  homeHref,
  onDismiss,
}: {
  course: string;
  lessonCount: number;
  mission: string | null;
  // The lesson to start on: `resumeLessonKey`'s target — lesson 1 for a genuinely
  // new reader, their next one if they carry progress. Null when the course has no
  // published lessons, and then there is nothing to offer.
  next: { seq: number; title: string; href: string } | null;
  // The tenant portal's front door (`tenantHomeHref`) — relative on the canonical
  // host, absolute when a Public link was opened off-host.
  homeHref: string;
  onDismiss: () => void;
}) {
  const t = useTranslations("Welcome");
  const brand = useTenant()?.displayName ?? "My Course";
  const excerpt = missionExcerpt(mission);

  return (
    <section
      aria-labelledby="welcome-heading"
      className="mb-4 rounded-2xl border border-line bg-card p-5 shadow-sm md:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-hi text-accent">
            <Icon name="book" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent2">{t("eyebrow")}</p>
            <h2 id="welcome-heading" className="text-lg font-semibold tracking-tight text-accent md:text-xl">
              {course}
            </h2>
            <p className="mt-0.5 text-xs text-soft">{t("lessonCount", { count: lessonCount })}</p>
          </div>
        </div>
        <IconButton icon="x" label={t("dismiss")} variant="ghost" onClick={onDismiss} />
      </div>

      {excerpt && <p className="mt-4 text-sm leading-relaxed text-ink">{excerpt}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        {next && (
          <Link
            href={next.href}
            onClick={onDismiss}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
          >
            {t("start", { seq: next.seq })}
            <Icon name="chevron" className="h-4 w-4 -rotate-90" />
          </Link>
        )}
        <Link href={homeHref} className="text-sm text-soft underline-offset-2 hover:text-accent hover:underline">
          {t("home", { brand })}
        </Link>
      </div>

      {next && <p className="mt-2 text-xs text-soft">{next.title}</p>}
    </section>
  );
}
