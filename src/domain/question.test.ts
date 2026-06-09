import { describe, expect, it } from "vitest";
import { answerQuestion, openQuestion } from "./question.js";

describe("openQuestion", () => {
  it("opens a Question against a Lesson, born open with no Reply", () => {
    const question = openQuestion({ lessonId: "lesson-1", text: "Why is this verb gendered?" });

    expect(question.lessonId).toBe("lesson-1");
    expect(question.text).toBe("Why is this verb gendered?");
    expect(question.state).toBe("open");
    expect(question.reply).toBeUndefined();
  });

  it("rejects opening a Question with empty text", () => {
    expect(() => openQuestion({ lessonId: "lesson-1", text: "   " })).toThrow(/text/i);
  });

  it("rejects opening a Question with no Lesson", () => {
    expect(() => openQuestion({ lessonId: "", text: "A real question" })).toThrow(/lesson/i);
  });
});

describe("answerQuestion", () => {
  it("answers an open Question, transitioning it to answered with the Reply bound", () => {
    const open = openQuestion({ lessonId: "lesson-1", text: "Why is this verb gendered?" });

    const answered = answerQuestion(open, "Hindi verbs agree with the subject's gender.");

    expect(answered.state).toBe("answered");
    expect(answered.reply).toEqual({ text: "Hindi verbs agree with the subject's gender." });
    expect(answered.lessonId).toBe("lesson-1");
  });

  it("rejects answering an already-answered Question, leaving it unchanged", () => {
    const answered = answerQuestion(
      openQuestion({ lessonId: "lesson-1", text: "Why is this verb gendered?" }),
      "Hindi verbs agree with the subject's gender.",
    );

    expect(() => answerQuestion(answered, "A different reply")).toThrow(/already answered/i);
    expect(answered.reply).toEqual({ text: "Hindi verbs agree with the subject's gender." });
    expect(answered.state).toBe("answered");
  });

  it("rejects an empty Reply", () => {
    const open = openQuestion({ lessonId: "lesson-1", text: "Why is this verb gendered?" });

    expect(() => answerQuestion(open, "   ")).toThrow(/reply/i);
  });
});
