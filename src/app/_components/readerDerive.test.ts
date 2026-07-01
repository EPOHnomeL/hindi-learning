import { describe, expect, it } from "vitest";
import {
  completedKeys,
  firstLessonKey,
  frontierKey,
  internalNavTarget,
  seenAfterOpening,
  unseenReplyKeys,
} from "./readerDerive";

describe("internalNavTarget", () => {
  it("passes an owner/viewer course link through unchanged", () => {
    expect(internalNavTarget("/courses/biz/lessons/0001-x", "/courses/biz/lessons/0004-y")).toBe(
      "/courses/biz/lessons/0001-x",
    );
  });

  it("remaps a cross-lesson link into the share context for a Guest", () => {
    expect(internalNavTarget("/courses/biz/lessons/0001-x", "/share/tok123/lessons/0004-y")).toBe(
      "/share/tok123/lessons/0001-x",
    );
  });

  it("remaps a reference link into the share context too", () => {
    expect(internalNavTarget("/courses/biz/references/ref-1", "/share/tok123/lessons/0004-y")).toBe(
      "/share/tok123/references/ref-1",
    );
  });

  it("leaves a non-artifact same-origin path alone even in a share context", () => {
    expect(internalNavTarget("/Handbook.pdf", "/share/tok123/lessons/0004-y")).toBe("/Handbook.pdf");
  });
});

describe("firstLessonKey", () => {
  it("returns the first lesson's key (listLessons is seq-ascending)", () => {
    const lessons = [
      { key: "0001-alpha", seq: 1, title: "Alpha" },
      { key: "0002-beta", seq: 2, title: "Beta" },
    ];
    expect(firstLessonKey(lessons)).toBe("0001-alpha");
  });

  it("returns null when there are no lessons", () => {
    expect(firstLessonKey([])).toBe(null);
  });
});

describe("frontierKey", () => {
  it("returns the last lesson's key (the Frontier — highest seq)", () => {
    const lessons = [
      { key: "0001-alpha", seq: 1, title: "Alpha" },
      { key: "0002-beta", seq: 2, title: "Beta" },
    ];
    expect(frontierKey(lessons)).toBe("0002-beta");
  });

  it("returns null when there are no lessons", () => {
    expect(frontierKey([])).toBe(null);
  });
});

describe("completedKeys", () => {
  it("collects only the lessonKeys marked completed (not merely opened)", () => {
    const progress = [
      { lessonKey: "0001-alpha", status: "completed" as const },
      { lessonKey: "0002-beta", status: "opened" as const },
      { lessonKey: "0003-gamma", status: "completed" as const },
    ];
    const done = completedKeys(progress);
    expect(done.has("0001-alpha")).toBe(true);
    expect(done.has("0003-gamma")).toBe(true);
    expect(done.has("0002-beta")).toBe(false);
    expect(done.size).toBe(2);
  });
});

describe("unseenReplyKeys", () => {
  const questions = [
    { id: "q1", lessonKey: "0001-alpha", reply: "Here's the answer." },
    { id: "q2", lessonKey: "0002-beta", reply: null }, // open, no reply yet
    { id: "q3", lessonKey: "0003-gamma", reply: "Another answer." },
  ];

  it("flags lessons whose reply the learner has not yet seen", () => {
    const dots = unseenReplyKeys(questions, new Set());
    expect(dots.has("0001-alpha")).toBe(true);
    expect(dots.has("0003-gamma")).toBe(true);
  });

  it("ignores questions with no reply", () => {
    const dots = unseenReplyKeys(questions, new Set());
    expect(dots.has("0002-beta")).toBe(false);
  });

  it("drops a lesson once its replied question has been seen", () => {
    const dots = unseenReplyKeys(questions, new Set(["q1"]));
    expect(dots.has("0001-alpha")).toBe(false);
    expect(dots.has("0003-gamma")).toBe(true);
  });
});

describe("seenAfterOpening", () => {
  const questions = [
    { id: "q1", lessonKey: "0001-alpha", reply: "answer" },
    { id: "q2", lessonKey: "0001-alpha", reply: null }, // open, no reply
    { id: "q3", lessonKey: "0002-beta", reply: "answer" },
  ];

  it("marks the opened lesson's replied questions as seen", () => {
    const next = seenAfterOpening(questions, "0001-alpha", new Set());
    expect(next.has("q1")).toBe(true);
  });

  it("does not mark questions from other lessons, or unanswered ones", () => {
    const next = seenAfterOpening(questions, "0001-alpha", new Set());
    expect(next.has("q2")).toBe(false); // same lesson, no reply
    expect(next.has("q3")).toBe(false); // other lesson
  });

  it("returns the same set reference when there is nothing new to mark", () => {
    const seen = new Set(["q1"]);
    expect(seenAfterOpening(questions, "0001-alpha", seen)).toBe(seen);
  });

  it("returns the same set reference when the lesson has no replied questions", () => {
    const seen = new Set<string>();
    expect(seenAfterOpening(questions, "0002-beta", new Set(["q3"]))).not.toBe(seen);
    // a lesson with no replies at all leaves seen untouched
    expect(seenAfterOpening(questions, "no-such-lesson", seen)).toBe(seen);
  });
});
