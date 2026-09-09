// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { quizStructureMatches, quizVerdict, unresolvableAnswerKeys } from "./quizGate";
import { shuffleQuizOptions } from "./quizShuffle";

// The quiz-structure gate (ticket 26) and the answer-key validator (ticket 35).
// Both are pure and both are checked against the markup the authoring contract
// actually specifies, read off `lessons/AUTHORING.md` rather than invented here,
// so a change to the contract shows up as a failure instead of as two documents
// quietly disagreeing.

// The multiple-choice shape, exactly as `lessons/AUTHORING.md` section 3 gives it.
const MCQ = (correct: string) => `
<div class="quiz" data-correct="${correct}" data-ok="Right." data-no="Not quite.">
  <div class="q">1. Which one?</div>
  <div class="opts">
    <button class="opt" data-k="a">alpha</button>
    <button class="opt" data-k="b">bravo</button>
    <button class="opt" data-k="c">charlie</button>
  </div>
  <div class="fb"></div>
</div>`;

// The fill-in shape: no `data-correct` and no options, so the validator has
// nothing to resolve and must not invent a complaint.
const FILL = `
<div class="quiz fill" data-answer="namaste" data-alt="namaskar" data-ok="Correct." data-no="Not yet.">
  <div class="q">2. Say hello.</div>
  <div style="margin-top:14px"><input type="text"><button>Check</button></div>
  <div class="fb"></div>
</div>`;

// ---- the structure gate -------------------------------------------------------

test("quizStructureMatches counts the three scoring markers and nothing else", () => {
  expect(quizStructureMatches(MCQ("b"), MCQ("b").replace("Which one?", "Cual?"))).toBe(true);
  // A dropped option changes the `data-k` count, which breaks positional identity.
  expect(quizStructureMatches(MCQ("b"), MCQ("b").replace(/<button class="opt" data-k="c">.*?<\/button>/, ""))).toBe(
    false,
  );
  // Changing WHICH key is correct is not a structural change: same counts. The
  // gate protects identity, not the author's answer.
  expect(quizStructureMatches(MCQ("b"), MCQ("c"))).toBe(true);
});

test("quizVerdict names the unreadable case instead of leaving it to each caller", () => {
  // The distinction ticket 26 exists for. Six call sites each had to remember
  // that a source they could not read is not permission to publish, and one of
  // them (`publishTranslation`) got it wrong by having a guard that never fired.
  expect(quizVerdict(MCQ("b"), MCQ("b"))).toBe("ok");
  expect(quizVerdict(MCQ("b"), FILL)).toBe("mismatch");
  expect(quizVerdict(null, MCQ("b"))).toBe("unreadable");
});

// ---- the answer key ------------------------------------------------------------

test("an answer key naming an option that exists publishes", () => {
  expect(unresolvableAnswerKeys(MCQ("a"))).toEqual([]);
  expect(unresolvableAnswerKeys(MCQ("b"))).toEqual([]);
  expect(unresolvableAnswerKeys(MCQ("c"))).toEqual([]);
});

test("an answer key naming no option is caught, which is ticket 35's whole defect", () => {
  // The exact body the ticket describes: `data-correct="d"` with options a, b, c.
  // Every option is marked wrong, none is ever highlighted correct, and the quiz
  // bridge reports `correct:false` for whatever the learner picked, so the
  // teaching loop is told they failed a question that could not be passed.
  expect(unresolvableAnswerKeys(MCQ("d"))).toEqual(["d"]);
  // An empty key is a different authoring slip with the same consequence.
  expect(unresolvableAnswerKeys(MCQ(""))).toEqual(["(quiz 1: empty)"]);
});

test("a fill-in quiz has no answer key to resolve and is left alone", () => {
  expect(unresolvableAnswerKeys(FILL)).toEqual([]);
  // And a lesson mixing both kinds reports only the broken multiple choice.
  expect(unresolvableAnswerKeys(`<p>prose</p>${FILL}${MCQ("z")}${FILL}`)).toEqual(["z"]);
});

test("each quiz's key resolves against its OWN options, not the lesson's", () => {
  // The failure mode a naive whole-document scan has: two quizzes, the second
  // one broken, and the first one's options making it look fine.
  const twoQuizzes = MCQ("a") + MCQ("z");
  expect(unresolvableAnswerKeys(twoQuizzes)).toEqual(["z"]);
  // Reversed, so it is the FIRST quiz that is broken.
  expect(unresolvableAnswerKeys(MCQ("z") + MCQ("a"))).toEqual(["z"]);
});

test("the publish-time shuffle never invalidates an answer key", () => {
  // ADR 0019 shuffles each quiz's options at publish and keeps `data-correct` as
  // a key letter rather than a position, so the validator and the shuffle cannot
  // disagree. If a future shuffle rewrote the keys, this fails.
  const shuffled = shuffleQuizOptions(MCQ("b"));
  expect(unresolvableAnswerKeys(shuffled)).toEqual([]);
  expect(quizStructureMatches(MCQ("b"), shuffled)).toBe(true);
});

test("the wrapped document does not confuse the validator with the feedback script", () => {
  // `assembleLesson` appends `lessons/_partials/foot.html`, whose script reads
  // these same attribute names. The validator matches `data-correct=` followed by
  // a quote, and the script says `getAttribute('data-correct')`, so it does not
  // match. Checked against the real partial rather than a paraphrase of it.
  const foot = readFileSync("lessons/_partials/foot.html", "utf8");
  expect(foot).toContain("data-correct");
  expect(unresolvableAnswerKeys(`<div class="wrap">${MCQ("b")}</div>${foot}`)).toEqual([]);
  expect(unresolvableAnswerKeys(`<div class="wrap">${MCQ("d")}</div>${foot}`)).toEqual(["d"]);
});

test("the authoring contract still specifies the markup this validator reads", () => {
  // The contract is the input, so it is asserted rather than assumed. If
  // `lessons/AUTHORING.md` moves to a different attribute set, this fails and the
  // validator gets updated with it.
  const contract = readFileSync("lessons/AUTHORING.md", "utf8");
  expect(contract).toContain(".quiz[data-correct]");
  expect(contract).toContain('.opt[data-k]');
  expect(contract).toContain("`data-correct` is a key letter, not a position");
});
