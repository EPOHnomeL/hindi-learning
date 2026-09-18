"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { quizMockState } from "./phoneQuiz";

// Phone mockups of the product, **built in CSS** rather than screenshotted
// (spoorpet.com brief, 2026-08-07). The reason is maintenance, not novelty: a
// screenshot of the reader goes stale the first time the reader changes and
// nobody notices for months, whereas these re-skin with the tenant palette and
// can only rot in ways a build catches.
//
// The moments are the pitch: **a lesson**, **a quiz inside it**, and — where a
// tenant answers questions — **asking and getting an answer**. Deliberately NOT
// the certificate: it's a PNG with no compliance weight behind it, so leading
// with it oversells.
//
// **Redrawn against the real reader 2026-08-18.** They used to invent chrome the
// product doesn't have — a bottom tab bar with Lessons/References/Ask — and fill
// the body with grey bars. Both read as a mockup of some other app. The frames
// now mirror `PublicReader`'s mobile shell (back arrow, course title carrying the
// drawer chevron, the lesson title beside "Next lesson →") and the lesson's own
// chrome (small-caps section heading, the gold-ruled `.verse` pull-out, a `.quiz`
// card whose chosen option goes green) as authored in `lessonSrcDoc.ts`. A tenant
// that supplies real words gets real words; the grey-bar `Prose` stays as the
// fallback for the translated landing, where inventing lesson prose in five
// languages would cost more than it says.
//
// The lesson and ask frames are `aria-hidden` decoration: the caption underneath
// each frame carries the actual claim, so a screen reader gets the point without
// wading through fake prose. The quiz frame is the exception (landing-page spec,
// 2026-09-18): its options are real buttons a visitor can tap to feel active
// recall before signing in, so that frame stays in the accessibility tree.

// The visible micro-copy inside the frames. Passed in rather than hardcoded so the
// default landing can translate it and YwamPotch.tsx can hand over its own — a
// Spanish landing showing English chrome looks unfinished, decoration or not.
export type PhoneMockCopy = {
  /** Demo course name, in the reader's top bar. A believable course, not "Example". */
  courseTitle: string;
  /** Where they are, e.g. "Lesson 4 of 24". Stands in as the lesson heading when
   *  no `lessonTitle` is given. */
  lessonProgress: string;
  /** The lesson's own title, as the reader pins it above the body. */
  lessonTitle?: string;
  /** The next-lesson button's label. Omit and no button is drawn. */
  nextLesson?: string;
  /** The lesson's small-caps section heading (an `h2` in an authored lesson). */
  lessonSection?: string;
  /** Real lesson prose, a paragraph per entry. Omit for the grey-bar stand-in. */
  lessonBody?: string[];
  /** The gold-ruled pull-out — a verse, a worked example. */
  verse?: string;
  /** The in-lesson ask affordance. Omit on a course nobody is answering questions on. */
  askCta?: string;
  /** The demo quiz stem. Short — it has to fit a phone. */
  quizQuestion: string;
  /** Three options; the FIRST is shown as the chosen, correct one. */
  quizOptions: [string, string, string];
  /** What the lesson says back once the right option is chosen. */
  quizFeedback?: string;
  /** What it says after a wrong tap. Omit and the wrong option just turns red. */
  quizRetry?: string;
  /** The invitation to tap, shown until something is chosen. Omit and the
   *  question stands alone. */
  quizNudge?: string;
  /** What the learner asked. */
  askedQuestion: string;
  /** What came back, inline. */
  askedReply: string;
  /** The follow-up. A thread with one exchange in it isn't a conversation, and it
   *  left a third of the frame empty. */
  askedFollowUp: string;
};

// The shared phone shell: status bar, the reader's own top bar, content. Fixed
// height so the frames line up in a row regardless of content — which means each
// screen's content has to roughly FILL it. A half-empty frame reads as a cropped
// screenshot, so the runs are tuned per screen.
function Phone({
  copy,
  interactive = false,
  children,
}: {
  copy: PhoneMockCopy;
  /** Keep the frame in the accessibility tree because it holds real controls. */
  interactive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden={interactive ? undefined : true}
      className="mx-auto flex h-[26rem] w-full max-w-[17rem] flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-sm"
    >
      {/* Status bar. The 9:41 is the convention every device mockup uses; a real
          clock here would be a hydration mismatch for no gain. No fake notch —
          the first attempt rendered as a stray bar floating above the frame's
          rounded edge, and a notch was never carrying any of the meaning. */}
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-[11px] text-soft">
        <span className="font-medium">9:41</span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-soft/50" />
          <span className="h-1.5 w-1.5 rounded-full bg-soft/50" />
          <span className="h-1.5 w-3 rounded-sm border border-soft/50" />
        </span>
      </div>

      {/* The reader's mobile header, as PublicReader draws it: back arrow, then the
          course title that opens the lesson drawer. */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-2.5 py-1.5">
        <svg
          className="h-3 w-3 shrink-0 text-soft"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        <span className="min-w-0 truncate text-[12px] font-semibold tracking-tight text-accent">
          {copy.courseTitle}
        </span>
        <svg
          className="h-2.5 w-2.5 shrink-0 text-accent"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-3 py-2.5">{children}</div>
    </div>
  );
}

// A run of grey bars standing in for prose, for a frame given no real words.
// `widths` in percent, so the last line can be short and the block reads as a
// paragraph rather than a table.
function Prose({ widths }: { widths: number[] }) {
  return (
    <span className="mt-2 block space-y-1.5">
      {widths.map((w, i) => (
        <span key={i} className="block h-2 rounded-sm bg-line" style={{ width: `${w}%` }} />
      ))}
    </span>
  );
}

// The lesson title row the reader pins above the lesson body, with the
// next-lesson button on its right.
function LessonHead({ copy }: { copy: PhoneMockCopy }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line pb-1.5">
      <span className="min-w-0 truncate text-[12px] font-semibold text-ink">
        {copy.lessonTitle ?? copy.lessonProgress}
      </span>
      {copy.nextLesson && (
        <span className="shrink-0 rounded-md bg-accent px-1.5 py-[3px] text-[8px] font-medium text-white">
          {copy.nextLesson} →
        </span>
      )}
    </div>
  );
}

// 1 — a lesson: section heading, prose, and the gold-ruled pull-out.
export function LessonMock({ copy }: { copy: PhoneMockCopy }) {
  return (
    <Phone copy={copy}>
      <LessonHead copy={copy} />
      <div className="mt-2">
        {copy.lessonSection && (
          <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-accent2">
            {copy.lessonSection}
          </div>
        )}
        {copy.lessonBody ? (
          <div className="mt-1.5 space-y-1.5">
            {copy.lessonBody.map((p) => (
              <p key={p} className="text-[10px] leading-[1.55] text-ink">
                {p}
              </p>
            ))}
          </div>
        ) : (
          <>
            <span className="mt-1.5 block h-2.5 w-2/3 rounded-sm bg-soft/40" />
            <Prose widths={[100, 96, 88, 100, 94, 82, 68]} />
          </>
        )}
        {/* The pull-out, because a lesson isn't only prose — `.verse` in an
            authored lesson: a card ruled gold down its left edge. */}
        <div className="mt-2 rounded-md border border-line border-s-[3px] border-s-gold bg-card px-2 py-1.5">
          {copy.verse ? (
            <p className="text-[10px] leading-[1.55] text-ink">{copy.verse}</p>
          ) : (
            <Prose widths={[80, 92, 58]} />
          )}
        </div>
        {copy.askCta && (
          <span className="mt-2 flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-[11px] text-soft">
            <Icon name="chat" className="h-2.5 w-2.5 text-accent" />
            {copy.askCta}
          </span>
        )}
      </div>
    </Phone>
  );
}

// 2 — a quiz inside the lesson, as `.quiz`/`.opt` render it, and the one frame a
// visitor can actually use (landing-page spec, 2026-09-18). Nothing is chosen
// until they tap: the first option goes green with the lesson's feedback, any
// other goes red with a retry line, and tapping again moves the mark. The state
// model is `quizMockState` so it can be tested without a DOM. Options are real
// buttons, tall enough to hit with a thumb on the phone the frame is imitating.
export function QuizMock({ copy }: { copy: PhoneMockCopy }) {
  const [selected, setSelected] = useState<number | null>(null);
  const { options, feedback } = quizMockState(selected, copy.quizOptions.length);
  const optionClass = {
    idle: "border-line text-ink hover:border-gold",
    correct: "border-good-b bg-good text-ink",
    wrong: "border-bad-b bg-bad text-ink",
  } as const;
  const note =
    feedback === "correct" ? copy.quizFeedback : feedback === "retry" ? copy.quizRetry : copy.quizNudge;
  return (
    <Phone copy={copy} interactive>
      <LessonHead copy={copy} />
      <div className="mt-2">
        <div className="rounded-lg border border-line bg-card p-2 shadow-sm">
          <div className="text-[11px] font-semibold leading-snug text-ink">{copy.quizQuestion}</div>
          <div className="mt-2 space-y-1">
            {copy.quizOptions.map((opt, i) => (
              <button
                key={opt}
                type="button"
                aria-pressed={selected === i}
                onClick={() => setSelected(i)}
                className={`flex min-h-9 w-full items-center justify-between gap-1 rounded-md border px-2 py-1 text-start text-[11px] leading-snug transition-colors motion-reduce:transition-none ${optionClass[options[i]!]}`}
              >
                {opt}
                {options[i] === "correct" && <Icon name="check" className="h-2.5 w-2.5 shrink-0 text-good-b" />}
                {options[i] === "wrong" && <Icon name="x" className="h-2.5 w-2.5 shrink-0 text-bad-b" />}
              </button>
            ))}
          </div>
          {/* One slot, three messages: the nudge, the lesson's feedback, or the
              retry line. `role=status` so a screen reader hears the mark land. */}
          {note && (
            <p
              role="status"
              className={`mt-1.5 text-[10px] leading-snug ${
                feedback === "correct" ? "text-good-b" : feedback === "retry" ? "text-bad-b" : "text-soft"
              }`}
            >
              {note}
            </p>
          )}
        </div>
        {copy.lessonBody ? (
          <p className="mt-2 text-[10px] leading-[1.55] text-ink">{copy.lessonBody[0]}</p>
        ) : (
          <Prose widths={[96, 88, 74]} />
        )}
      </div>
    </Phone>
  );
}

// 3 — asking mid-lesson and getting an answer in the lesson where you asked it.
export function AskMock({ copy }: { copy: PhoneMockCopy }) {
  return (
    <Phone copy={copy}>
      <LessonHead copy={copy} />
      <div className="mt-2 space-y-2">
        {/* The learner's question — right-aligned, the universal "mine". */}
        <div className="ms-6 rounded-md rounded-ee-sm bg-hi px-2 py-1.5 text-[11px] leading-snug text-ink">
          {copy.askedQuestion}
        </div>
        {/* The reply, inline and attributed with the same avatar treatment the
            reader uses. */}
        <div className="me-4 flex items-start gap-1.5">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Icon name="book" className="h-2 w-2" />
          </span>
          <span className="rounded-md rounded-es-sm border border-line bg-card px-2 py-1.5">
            <span className="block text-[11px] leading-snug text-soft">{copy.askedReply}</span>
            <Prose widths={[92, 100, 88, 96, 70]} />
          </span>
        </div>
        {/* The follow-up, so the frame shows a conversation rather than a single
            answered question. */}
        <div className="ms-6 rounded-md rounded-ee-sm bg-hi px-2 py-1.5 text-[11px] leading-snug text-ink">
          {copy.askedFollowUp}
        </div>
      </div>
    </Phone>
  );
}

// The row, with captions. `captions` pairs each frame with the claim it
// illustrates — the caption is the accessible content, the frame is decoration.
// One to three of them, in order (lesson, quiz, ask): a course whose learners
// don't ask questions has nothing to show in the third frame, and a promise the
// product isn't keeping is worse than a shorter row.
export function PhoneMockRow({ copy, captions }: { copy: PhoneMockCopy; captions: { title: string; body: string }[] }) {
  const frames = [LessonMock, QuizMock, AskMock].slice(0, captions.length);
  // Staggered rather than simultaneous — frames landing at once read as one slab
  // (see `.land-reveal-mid`/`-late` in globals.css).
  const cascade = ["land-reveal", "land-reveal-mid", "land-reveal-late"];
  return (
    <div
      className={`mt-14 grid gap-10 ${frames.length === 2 ? "mx-auto max-w-2xl sm:grid-cols-2" : "sm:grid-cols-3"}`}
    >
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
