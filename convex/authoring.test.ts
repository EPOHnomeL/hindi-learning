/// <reference types="vite/client" />
import { expect, test } from "vitest";
import {
  assembleLesson,
  buildMissionMessages,
  buildOngoingMessages,
  nextLessonKey,
  parseAuthoringResult,
  parseMissionResult,
  supersedesFrom,
  titleFrom,
  type MaterialisedContext,
} from "./authoring";
import { shuffleQuizOptions } from "./quizShuffle";
import { LESSON_FOOT, LESSON_HEAD } from "./authoringAssets.generated";

const QUIZ_FRAGMENT = `<title>Lesson 2 · The Aorist</title>
<header class="lesson">Aorist</header>
<div class="quiz" data-correct="c">
  <div class="q">1. Pick c</div>
  <div class="opts">
    <button class="opt" data-k="a">alpha one two</button>
    <button class="opt" data-k="b">bravo one two</button>
    <button class="opt" data-k="c">charlie one two</button>
  </div>
  <div class="fb"></div>
</div>`;

test("assembleLesson wraps a lean fragment with the bundled head/foot and shuffles quizzes", () => {
  const html = assembleLesson(QUIZ_FRAGMENT);

  // Wrapped into a complete document with the shared design system + foot script.
  expect(html).toMatch(/^<!DOCTYPE html>/);
  expect(html).toContain(LESSON_HEAD);
  expect(html).toContain(LESSON_FOOT);
  // Title stays in <head>; body carries the content without a duplicate <title>.
  expect(html).toContain("<title>Lesson 2 · The Aorist</title>");

  // The quiz options are shuffled by the same helper the CLI publish path uses —
  // expected value from that independent source, not recomputed by hand.
  const content = QUIZ_FRAGMENT.replace(/<title>[\s\S]*?<\/title>/i, "").trim();
  expect(html).toContain(shuffleQuizOptions(content));
});

test("assembleLesson passes through an already-complete document untouched", () => {
  const doc = "<!DOCTYPE html><html><head></head><body>done</body></html>";
  expect(assembleLesson(doc)).toBe(doc);
});

test("titleFrom / supersedesFrom read the fragment's meta", () => {
  expect(titleFrom("<title>Lesson 3 · Verbs</title>")).toBe("Verbs");
  expect(titleFrom("<title>Plain</title>")).toBe("Plain");
  expect(supersedesFrom('<meta name="supersedes" content="0001-old">')).toBe("0001-old");
  expect(supersedesFrom("<title>no meta</title>")).toBeUndefined();
});

test("nextLessonKey zero-pads the seq and dash-cases the title", () => {
  expect(nextLessonKey(2, "The Aorist!")).toBe("0002-the-aorist");
  expect(nextLessonKey(12, "Verbs & Nouns")).toBe("0012-verbs-nouns");
});

test("parseAuthoringResult reads the JSON contract, tolerating a code fence", () => {
  const raw = "```json\n" + JSON.stringify({ lessonHtml: "<title>x</title>", learningRecord: "# r", estimatedLessons: 8 }) + "\n```";
  expect(parseAuthoringResult(raw)).toEqual({
    complete: false,
    lessonHtml: "<title>x</title>",
    learningRecord: "# r",
    estimatedLessons: 8,
    replies: [],
  });

  // Estimate is optional; absent → undefined.
  expect(parseAuthoringResult(JSON.stringify({ lessonHtml: "<h1>a</h1>", learningRecord: "r" })).estimatedLessons).toBeUndefined();
});

test("parseAuthoringResult surfaces a terminate decision without a lesson", () => {
  const done = parseAuthoringResult(JSON.stringify({ complete: true, estimatedLessons: 6 }));
  expect(done.complete).toBe(true);
  expect(done.lessonHtml).toBeUndefined();
  expect(done.estimatedLessons).toBe(6);
});

test("parseAuthoringResult collects well-formed replies and drops malformed ones", () => {
  const r = parseAuthoringResult(
    JSON.stringify({
      lessonHtml: "<h1>a</h1>",
      learningRecord: "r",
      replies: [{ questionId: "q1", reply: "yes" }, { questionId: 5, reply: "bad" }, { reply: "no id" }],
    }),
  );
  expect(r.replies).toEqual([{ questionId: "q1", reply: "yes" }]);
});

test("parseAuthoringResult throws on malformed output or a non-complete run missing its lesson", () => {
  expect(() => parseAuthoringResult("not json at all")).toThrow();
  expect(() => parseAuthoringResult(JSON.stringify({ learningRecord: "r" }))).toThrow(/lessonHtml/);
});

test("parseMissionResult reads the mission markdown (fence-tolerant) and rejects empties", () => {
  expect(parseMissionResult('```json\n{"mission":"# Mission\\nread the NT"}\n```')).toEqual({ mission: "# Mission\nread the NT" });
  expect(() => parseMissionResult(JSON.stringify({ mission: "  " }))).toThrow(/mission/);
  expect(() => parseMissionResult("nope")).toThrow();
});

const SEEDED_CTX: MaterialisedContext = {
  topic: { slug: "greek", title: "Koine Greek", status: "seeded", mission: null, seed: "read the New Testament" },
  lessons: [],
  learningRecords: [],
  references: [],
  capture: { openQuestions: [], responses: [], progress: [] },
  frontier: null,
};

test("buildMissionMessages injects the seed and asks for the mission contract", () => {
  const [system, user] = buildMissionMessages(SEEDED_CTX);
  expect(system.role).toBe("system");
  expect(system.content).toContain('"mission"'); // the mission output contract
  expect(user.content).toContain("read the New Testament"); // the seed
});

test("buildOngoingMessages targets seq 1 when there is no Frontier (first lesson)", () => {
  const [, user] = buildOngoingMessages(SEEDED_CTX);
  expect(user.content).toContain("lesson number 1");
});
