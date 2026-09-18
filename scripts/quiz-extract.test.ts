import { describe, expect, it } from "vitest";
import { extractQuizzes, plain } from "./quiz-extract";

const CHOICE = `
<div class="quiz" data-correct="b" data-ok="&#10003; Yes &mdash; step 5." data-no="Not quite.">
  <div class="q">2. After quieting your mind, what next?</div>
  <div class="opts">
    <button class="opt" data-k="a">Try harder</button>
    <button class="opt" data-k="c">Doubt it</button>
    <button class="opt" data-k="b">Let Him speak, then believe it</button>
  </div>
  <div class="fb"></div>
</div>`;

const FILL = `
<div class="quiz fill" data-answer="peace" data-alt="Peace" data-ok="Right." data-no="Not yet.">
  <div class="q">4. Fill the blank: His voice "speaks in ____." (one word)</div>
  <div style="margin-top:14px"><input type="text"><button>Check</button></div>
  <div class="fb"></div>
</div>`;

describe("extractQuizzes", () => {
  it("reads a multiple-choice quiz, keeping authored option order", () => {
    const [q] = extractQuizzes(CHOICE);
    expect(q).toMatchObject({
      index: 1,
      kind: "choice",
      question: "2. After quieting your mind, what next?",
      answerKey: "b",
      answer: "Let Him speak, then believe it",
      feedbackWrong: "Not quite.",
    });
    expect(q!.options).toEqual(["a. Try harder", "c. Doubt it", "b. Let Him speak, then believe it"]);
    // Entities are decoded so the sheet holds text, not markup.
    expect(q!.feedbackCorrect).toBe(`✓ Yes ${String.fromCodePoint(0x2014)} step 5.`);
  });

  it("reads a fill-in quiz, taking the answer off data-answer", () => {
    const [q] = extractQuizzes(FILL);
    expect(q).toMatchObject({ kind: "fill", answer: "peace", answerKey: "peace", answerAlt: "Peace" });
    expect(q!.options).toEqual([]);
  });

  it("numbers quizzes by position across a whole body", () => {
    const quizzes = extractQuizzes(`<body>${CHOICE}${FILL}</body>`);
    expect(quizzes.map((q) => q.index)).toEqual([1, 2]);
    expect(quizzes.map((q) => q.kind)).toEqual(["choice", "fill"]);
  });

  it("flags an answer key that names no option, rather than emitting a blank answer", () => {
    const [q] = extractQuizzes(CHOICE.replace('data-correct="b"', 'data-correct="d"'));
    expect(q!.answer).toBe('(unresolved key "d")');
  });

  it("finds nothing in a body with no quizzes", () => {
    expect(extractQuizzes("<p>just prose</p>")).toEqual([]);
  });

  it("collapses whitespace and strips inline markup from question text", () => {
    expect(plain("<div>  a <b>bold</b>\n  word  </div>")).toBe("a bold word");
  });
});
