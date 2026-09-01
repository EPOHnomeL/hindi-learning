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
// both named.
//
// `next` null means the last published lesson. It used to render a dashed
// "That's the last lesson" card and the completion control floated above it as a
// FAB; both went on 2026-09-01. The card said nothing a reader who had just run
// out of lessons didn't already know, and the FAB ate a corner of every screen of
// the last lesson to say it. What is left is `finish`: the completion action
// itself, inline, found by scrolling to the foot of the page like every other
// way forward in this reader. No `finish` (already complete, or a Guest) → the
// end of the lesson is simply the end of the page.
export function LessonFootCard({
  next,
  completed,
  onAdvance,
  finish,
}: {
  next: { href: string; seq: number; title: string } | null;
  completed: boolean;
  onAdvance: () => void;
  finish?: { label: string; onClick: () => void } | null;
}) {
  const t = useTranslations("Artifact");

  if (!next) {
    if (!finish) return null;
    return (
      <div className="px-3 pb-1 pt-4">
        <button
          type="button"
          onClick={finish.onClick}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-good-b px-4 py-4 text-sm font-semibold text-white transition-colors hover:bg-good-b/90"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{finish.label}</span>
        </button>
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
