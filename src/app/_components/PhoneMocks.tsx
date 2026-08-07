"use client";

import { Icon } from "./icons";

// Three phone mockups of the product, **built in CSS** rather than screenshotted
// (spoorpet.com brief, 2026-08-07). The reason is maintenance, not novelty: a
// screenshot of the reader goes stale the first time the reader changes and
// nobody notices for months, whereas these re-skin with the tenant palette and
// can only rot in ways a build catches.
//
// The three moments are the pitch: **a lesson**, **a quiz inside it**, and
// **asking a question and getting an answer**. Deliberately NOT the certificate —
// it's a PNG with no compliance weight behind it, so leading with it oversells.
//
// Everything here is `aria-hidden` decoration: the caption underneath each frame
// carries the actual claim, so a screen reader gets the point without wading
// through fake prose. Prose inside the frames is grey bars, not lorem — bars read
// as "text goes here" instantly and need no translating.

// The visible micro-copy inside the frames. Passed in rather than hardcoded so the
// default landing can translate it and YwamPotch.tsx can hand over its own — a
// Spanish landing showing English chrome looks unfinished, decoration or not.
export type PhoneMockCopy = {
  /** Demo course name in the frame header. A believable course, not "Example". */
  courseTitle: string;
  /** Where they are, e.g. "Lesson 4 of 24". */
  lessonProgress: string;
  /** The in-lesson ask affordance. */
  askCta: string;
  /** The demo quiz stem. Short — it has to fit a phone. */
  quizQuestion: string;
  /** Three options; the FIRST is shown as the chosen, correct one. */
  quizOptions: [string, string, string];
  /** What the learner asked. */
  askedQuestion: string;
  /** What came back, inline. */
  askedReply: string;
  /** The follow-up. A thread with one exchange in it isn't a conversation, and it
   *  left a third of the frame empty. */
  askedFollowUp: string;
  /** Bottom-nav labels. */
  navLessons: string;
  navReferences: string;
  navAsk: string;
};

// The shared phone shell: status bar, content, bottom nav. Fixed height so all
// three frames line up in a row regardless of content — which means each screen's
// content has to roughly FILL it. A half-empty frame reads as a cropped
// screenshot, so the prose runs are tuned per screen to reach the nav.
function Phone({ copy, tab, children }: { copy: PhoneMockCopy; tab: "lessons" | "ask"; children: React.ReactNode }) {
  const tabs = [
    { id: "lessons", label: copy.navLessons, icon: "book" as const },
    { id: "references", label: copy.navReferences, icon: "refresh" as const },
    { id: "ask", label: copy.navAsk, icon: "chat" as const },
  ];
  return (
    <div
      aria-hidden
      className="mx-auto flex h-92 w-full max-w-[15rem] flex-col overflow-hidden rounded-xl border border-line bg-card shadow-sm"
    >
      {/* Status bar. The 9:41 is the convention every device mockup uses; a real
          clock here would be a hydration mismatch for no gain. No fake notch —
          the first attempt rendered as a stray bar floating above the frame's
          rounded edge, and a notch was never carrying any of the meaning. */}
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-[9px] text-soft">
        <span className="font-medium">9:41</span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-soft/50" />
          <span className="h-1.5 w-1.5 rounded-full bg-soft/50" />
          <span className="h-1.5 w-3 rounded-sm border border-soft/50" />
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">{children}</div>

      <div className="flex border-t border-line">
        {tabs.map((t) => (
          <span
            key={t.id}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[8px] ${
              t.id === tab ? "text-accent" : "text-soft/60"
            }`}
          >
            <Icon name={t.icon} className="h-3 w-3" />
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// A run of grey bars standing in for prose. `widths` in percent, so the last line
// can be short and the block reads as a paragraph rather than a table.
function Prose({ widths }: { widths: number[] }) {
  return (
    <span className="mt-2 block space-y-1.5">
      {widths.map((w, i) => (
        <span key={i} className="block h-1.5 rounded-sm bg-line" style={{ width: `${w}%` }} />
      ))}
    </span>
  );
}

// The frame header both content screens carry: course name and position.
function LessonHead({ copy }: { copy: PhoneMockCopy }) {
  return (
    <div className="border-b border-line pb-2">
      <div className="text-[8px] uppercase tracking-[0.2em] text-accent2">{copy.lessonProgress}</div>
      <div className="mt-1 truncate text-[11px] font-semibold text-ink">{copy.courseTitle}</div>
    </div>
  );
}

// 1 — an interactive lesson, written from the learner's own sources.
export function LessonMock({ copy }: { copy: PhoneMockCopy }) {
  return (
    <Phone copy={copy} tab="lessons">
      <LessonHead copy={copy} />
      <div className="mt-2.5">
        <span className="block h-2 w-2/3 rounded-sm bg-soft/40" />
        <Prose widths={[100, 96, 88, 100, 94, 82, 68]} />
        {/* A pull-out, because a lesson isn't only prose — it has worked examples. */}
        <span className="mt-3 block rounded-md border border-gold/40 bg-gold/10 p-2">
          <Prose widths={[80, 92, 58]} />
        </span>
        <span className="mt-3 flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-[9px] text-soft">
          <Icon name="chat" className="h-2.5 w-2.5 text-accent" />
          {copy.askCta}
        </span>
      </div>
    </Phone>
  );
}

// 2 — a quiz inside the lesson. The first option is shown chosen and correct: a
// mockup of an unanswered quiz shows nothing about what the product does.
export function QuizMock({ copy }: { copy: PhoneMockCopy }) {
  return (
    <Phone copy={copy} tab="lessons">
      <LessonHead copy={copy} />
      <div className="mt-2.5">
        <div className="text-[10px] font-medium leading-snug text-ink">{copy.quizQuestion}</div>
        <div className="mt-2.5 space-y-1.5">
          {copy.quizOptions.map((opt, i) => (
            <div
              key={opt}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[9px] leading-snug ${
                i === 0 ? "border-good-b/50 bg-good text-ink" : "border-line text-soft"
              }`}
            >
              {i === 0 ? (
                <Icon name="check" className="h-2.5 w-2.5 shrink-0 text-good-b" />
              ) : (
                <span className="h-2 w-2 shrink-0 rounded-full border border-line" />
              )}
              <span className="truncate">{opt}</span>
            </div>
          ))}
        </div>
        <Prose widths={[96, 88, 92, 74]} />
      </div>
    </Phone>
  );
}

// 3 — asking mid-lesson and getting an answer in the lesson where you asked it.
export function AskMock({ copy }: { copy: PhoneMockCopy }) {
  return (
    <Phone copy={copy} tab="ask">
      <LessonHead copy={copy} />
      <div className="mt-2.5 space-y-2">
        {/* The learner's question — right-aligned, the universal "mine". */}
        <div className="ml-6 rounded-md rounded-br-sm bg-hi px-2 py-1.5 text-[9px] leading-snug text-ink">
          {copy.askedQuestion}
        </div>
        {/* The reply, inline and attributed with the same avatar treatment the
            reader uses. */}
        <div className="mr-4 flex items-start gap-1.5">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Icon name="book" className="h-2 w-2" />
          </span>
          <span className="rounded-md rounded-bl-sm border border-line bg-card px-2 py-1.5">
            <span className="block text-[9px] leading-snug text-soft">{copy.askedReply}</span>
            <Prose widths={[92, 100, 88, 96, 70]} />
          </span>
        </div>
        {/* The follow-up, so the frame shows a conversation rather than a single
            answered question. */}
        <div className="ml-6 rounded-md rounded-br-sm bg-hi px-2 py-1.5 text-[9px] leading-snug text-ink">
          {copy.askedFollowUp}
        </div>
      </div>
    </Phone>
  );
}

// The row of three, with captions. `items` pairs each frame with the claim it
// illustrates — the caption is the accessible content, the frame is decoration.
export function PhoneMockRow({
  copy,
  captions,
}: {
  copy: PhoneMockCopy;
  captions: [{ title: string; body: string }, { title: string; body: string }, { title: string; body: string }];
}) {
  const frames = [LessonMock, QuizMock, AskMock];
  // Staggered rather than simultaneous — three frames landing at once read as one
  // slab (see `.land-reveal-mid`/`-late` in globals.css).
  const cascade = ["land-reveal", "land-reveal-mid", "land-reveal-late"];
  return (
    <div className="mt-14 grid gap-10 sm:grid-cols-3">
      {frames.map((Frame, i) => (
        <figure key={captions[i]!.title} className={cascade[i]}>
          <Frame copy={copy} />
          <figcaption className="mt-5 text-center">
            <div className="font-semibold text-ink">{captions[i]!.title}</div>
            <div className="mt-1.5 text-sm leading-relaxed text-soft">{captions[i]!.body}</div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
