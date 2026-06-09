import { describe, expect, it } from "vitest";
import { advanceProgress, parseQuestion, parseResponse } from "./protocol.js";

describe("parseResponse", () => {
  it("parses a valid quiz Response tied to a prompt within a Lesson", () => {
    const response = parseResponse({
      lessonId: "0001-greetings",
      promptId: "q3",
      kind: "quiz",
      value: "b",
      correctness: true,
    });

    expect(response).toEqual({
      lessonId: "0001-greetings",
      promptId: "q3",
      kind: "quiz",
      value: "b",
      correctness: true,
    });
  });

  it("rejects a Response with no prompt (a Response must answer a prompt)", () => {
    expect(() =>
      parseResponse({ lessonId: "0001-greetings", kind: "quiz", value: "b" }),
    ).toThrow(/prompt/i);
  });

  it("rejects a Response with no Lesson", () => {
    expect(() =>
      parseResponse({ promptId: "q3", kind: "quiz", value: "b" }),
    ).toThrow(/lesson/i);
  });

  it("rejects a Response with an unknown kind", () => {
    expect(() =>
      parseResponse({ lessonId: "0001-greetings", promptId: "q3", kind: "essay", value: "b" }),
    ).toThrow(/kind/i);
  });

  it("rejects a Response with no value", () => {
    expect(() =>
      parseResponse({ lessonId: "0001-greetings", promptId: "q3", kind: "free_text" }),
    ).toThrow(/value/i);
  });

  it("accepts a free-text Response without correctness", () => {
    const response = parseResponse({
      lessonId: "0001-greetings",
      promptId: "q3",
      kind: "free_text",
      value: "मैं ठीक हूँ",
    });

    expect(response.kind).toBe("free_text");
    expect(response.correctness).toBeUndefined();
  });
});

describe("parseQuestion", () => {
  it("parses a valid Question payload tied to a Lesson", () => {
    const question = parseQuestion({
      lessonId: "0001-greetings",
      text: "When do I use the formal 'you'?",
    });

    expect(question).toEqual({
      lessonId: "0001-greetings",
      text: "When do I use the formal 'you'?",
    });
  });

  it("rejects a Question with no text", () => {
    expect(() => parseQuestion({ lessonId: "0001-greetings", text: "   " })).toThrow(/text/i);
  });

  it("rejects a Question with no Lesson", () => {
    expect(() => parseQuestion({ text: "A real question" })).toThrow(/lesson/i);
  });
});

describe("advanceProgress", () => {
  it("advances unseen -> opened -> completed", () => {
    expect(advanceProgress("unseen", "opened")).toBe("opened");
    expect(advanceProgress("opened", "completed")).toBe("completed");
    expect(advanceProgress("unseen", "completed")).toBe("completed");
  });

  it("never regresses to an earlier state", () => {
    expect(advanceProgress("completed", "opened")).toBe("completed");
    expect(advanceProgress("opened", "unseen")).toBe("opened");
    expect(advanceProgress("completed", "unseen")).toBe("completed");
  });

  it("is stable when the incoming state matches the current one", () => {
    expect(advanceProgress("opened", "opened")).toBe("opened");
  });
});
