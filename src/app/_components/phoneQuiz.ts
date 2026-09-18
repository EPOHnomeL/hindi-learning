// The state model behind the landing page's tappable quiz mock (landing-page
// spec, 2026-09-18). Pure so it can be tested without a DOM: the vitest
// environment here is edge-runtime and the repo carries no React testing library.
//
// The FIRST option is always the correct one (see `PhoneMockCopy.quizOptions`).

export type QuizOptionState = "idle" | "correct" | "wrong";
export type QuizFeedback = "nudge" | "correct" | "retry";

export function quizMockState(selected: number | null, optionCount: number) {
  const options: QuizOptionState[] = Array.from({ length: optionCount }, (_, i) => {
    if (selected !== i) return "idle";
    return i === 0 ? "correct" : "wrong";
  });
  const feedback: QuizFeedback = selected === null ? "nudge" : selected === 0 ? "correct" : "retry";
  return { options, feedback };
}
