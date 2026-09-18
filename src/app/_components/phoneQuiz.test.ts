// @vitest-environment node
import { expect, test } from "vitest";
import { quizMockState } from "./phoneQuiz";

test("nothing chosen: every option idle, the nudge shows", () => {
  expect(quizMockState(null, 3)).toEqual({ options: ["idle", "idle", "idle"], feedback: "nudge" });
});

test("the first option is the correct one and reveals the feedback", () => {
  expect(quizMockState(0, 3)).toEqual({ options: ["correct", "idle", "idle"], feedback: "correct" });
});

test("any other option is marked wrong and asks for another go", () => {
  expect(quizMockState(1, 3)).toEqual({ options: ["idle", "wrong", "idle"], feedback: "retry" });
  expect(quizMockState(2, 3)).toEqual({ options: ["idle", "idle", "wrong"], feedback: "retry" });
});
