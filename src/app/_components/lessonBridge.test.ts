// @vitest-environment node
import { expect, test } from "vitest";
import { lessonMessage } from "./lessonSrcDoc";

// The inbound half of the lesson-iframe bridge (ticket 27). Half the protocol was
// typed builders in `lessonSrcDoc.ts` and the other half was four independent
// `window` listeners in `ArtifactView.tsx`, each casting `e.data` inline with its
// own shape. The parser is testable without a DOM, which the four casts were not.

// A `MessageEvent` is only `{ source, data }` as far as this parser cares, so the
// tests do not need jsdom or a real frame.
const FRAME = { name: "the lesson frame" } as unknown as Window;
const OTHER = { name: "some other frame" } as unknown as Window;
const evt = (data: unknown, source: unknown = FRAME) => ({ data, source }) as unknown as MessageEvent;

const lesson = (extra: Record<string, unknown>) => ({ __lesson: true, ...extra });

test("a message from another frame is refused, whatever it says", () => {
  // Two of the four listeners never checked `e.source`, so any frame on the page
  // could resize the lesson or record a quiz answer against the reader's
  // Progress. This is that check, in the one place it can be forgotten from.
  expect(lessonMessage(evt(lesson({ type: "height", height: 900 }), OTHER), FRAME)).toBeNull();
  expect(lessonMessage(evt(lesson({ type: "response", quizId: "q1", correct: true }), OTHER), FRAME)).toBeNull();
});

test("no frame trusts nothing, so a listener bound before the iframe mounts drops messages", () => {
  // The failure mode of an optional frame argument: a listener that runs before
  // the ref is populated would accept from anywhere.
  expect(lessonMessage(evt(lesson({ type: "height", height: 900 })), null)).toBeNull();
  expect(lessonMessage(evt(lesson({ type: "height", height: 900 })), undefined)).toBeNull();
});

test("only a lesson's own messages are parsed", () => {
  expect(lessonMessage(evt({ type: "height", height: 900 }), FRAME)).toBeNull(); // no __lesson
  expect(lessonMessage(evt(lesson({ type: "somethingElse" })), FRAME)).toBeNull();
  expect(lessonMessage(evt(lesson({})), FRAME)).toBeNull(); // no type
  expect(lessonMessage(evt(null), FRAME)).toBeNull();
  expect(lessonMessage(evt("a string"), FRAME)).toBeNull();
  // The theme message goes the other way (parent to frame) and is not inbound.
  expect(lessonMessage(evt({ __lessonTheme: true, theme: "dark" }), FRAME)).toBeNull();
});

test("height is a number or it is nothing", () => {
  expect(lessonMessage(evt(lesson({ type: "height", height: 900 })), FRAME)).toEqual({ type: "height", height: 900 });
  // A string height would have set a CSS length from attacker-controlled text.
  expect(lessonMessage(evt(lesson({ type: "height", height: "900" })), FRAME)).toBeNull();
  expect(lessonMessage(evt(lesson({ type: "height" })), FRAME)).toBeNull();
});

test("navigate needs a string href, and newTab is coerced", () => {
  expect(lessonMessage(evt(lesson({ type: "navigate", href: "https://x.test/a" })), FRAME)).toEqual({
    type: "navigate",
    href: "https://x.test/a",
    newTab: false,
  });
  expect(lessonMessage(evt(lesson({ type: "navigate", href: "/a", newTab: 1 })), FRAME)).toEqual({
    type: "navigate",
    href: "/a",
    newTab: true,
  });
  expect(lessonMessage(evt(lesson({ type: "navigate" })), FRAME)).toBeNull();
});

test("a response needs a quizId, because there is nothing to record it against", () => {
  expect(lessonMessage(evt(lesson({ type: "response", quizId: "q1", answer: "b", correct: true })), FRAME)).toEqual({
    type: "response",
    quizId: "q1",
    answer: "b",
    correct: true,
  });
  // An unanswered quiz still reports, so an absent answer is the empty string
  // rather than a dropped message.
  expect(lessonMessage(evt(lesson({ type: "response", quizId: "q1" })), FRAME)).toEqual({
    type: "response",
    quizId: "q1",
    answer: "",
    correct: false,
  });
  expect(lessonMessage(evt(lesson({ type: "response", quizId: "" })), FRAME)).toBeNull();
  expect(lessonMessage(evt(lesson({ type: "response" })), FRAME)).toBeNull();
});

test("a share card stringifies its two fields rather than dropping the message", () => {
  // The bridge reads these out of the DOM, so an empty definition is ordinary.
  expect(lessonMessage(evt(lesson({ type: "shareCard", term: "namaste" })), FRAME)).toEqual({
    type: "shareCard",
    term: "namaste",
    definition: "",
  });
});

test("no listener casts e.data any more", () => {
  // The shape that let the two halves of the protocol drift: a per-listener cast,
  // each one deciding for itself what to check.
  const sources = import.meta.glob("./**/*.tsx", { query: "?raw", import: "default", eager: true }) as Record<
    string,
    string
  >;
  const offenders = Object.entries(sources)
    .filter(([, s]) => /e\.data as \{[^}]*__lesson/.test(s))
    .map(([p]) => p);
  expect(offenders).toEqual([]);
});
