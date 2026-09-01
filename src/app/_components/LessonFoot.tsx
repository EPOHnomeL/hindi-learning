"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

// The end-of-lesson Next card, at every breakpoint. It was mobile only from the
// mobile bottom nav of 2026-08-23 until 2026-09-01, when the separate desktop
// "Mark complete" button was retired and advancing became the one way forward.
// Rendered at the foot of the lesson body, which is where a reader who just
// finished actually is, and shared by the authed reader (ArtifactView) and the
// Guest reader (PublicReader). Before it existed the only next-lesson link was
// a top-bar button gated on readOnly, so a course OWNER on a phone had no
// forward navigation at all.
//
// Advancing marks the lesson being left complete, and the label says so
// ("Complete and continue") rather than doing it silently: Progress gates
// certificate eligibility and feeds the authoring Routine, so lessons ticked by
// a reader who only tapped past would read as a bug. One tap, two effects,
// both named. `next` null means the last published lesson: a dashed
// nothing-further card, deliberately neutral wording because on an active
// course this is the Frontier, not the end.
export function LessonFootCard({
  next,
  completed,
  onAdvance,
}: {
  next: { href: string; seq: number; title: string } | null;
  completed: boolean;
  onAdvance: () => void;
}) {
  const t = useTranslations("Artifact");

  if (!next) {
    return (
      <div className="px-3 pb-1 pt-4">
        <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center">
          <p className="text-sm font-semibold text-accent">{t("lastLessonTitle")}</p>
          <p className="mt-1 text-xs text-soft">{t("lastLessonBody")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pb-1 pt-4">
      <Link
        href={next.href}
        onClick={() => {
          if (!completed) onAdvance();
        }}
        className="flex items-center gap-3 rounded-2xl border border-accent bg-hi/40 px-4 py-4 transition-colors hover:bg-hi active:bg-hi"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-widest text-accent2">
            {completed ? t("next") : t("completeAndContinue")}
          </span>
          <span className="mt-0.5 block text-base font-semibold leading-snug text-accent">
            {next.seq}. {next.title}
          </span>
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      </Link>
    </div>
  );
}
