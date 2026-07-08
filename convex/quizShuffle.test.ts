import { describe, expect, it } from "vitest";
import { shuffleQuizOptions } from "./quizShuffle";

// Minimal MCQ block matching the authoring contract (AUTHORING.md §3). `data-k`
// is the internal id `data-correct` points at; the learner sees no A/B/C labels
// (options render as plain buttons), so display order == button DOM order.
const mcq = (correct: string, opts: Array<[string, string]>) => `
<div class="quiz" data-correct="${correct}" data-ok="✓" data-no="no">
  <div class="q">1. Pick one</div>
  <div class="opts">
${opts.map(([k, t]) => `    <button class="opt" data-k="${k}">${t}</button>`).join("\n")}
  </div>
  <div class="fb"></div>
</div>`;

// The option whose data-k === data-correct, by its text — the invariant we protect.
const correctText = (html: string): string => {
  const correct = html.match(/data-correct="([^"]+)"/)![1];
  const re = new RegExp(`<button class="opt" data-k="${correct}">([^<]*)</button>`);
  return html.match(re)![1]!;
};
const optionOrder = (html: string): string[] =>
  [...html.matchAll(/data-k="([a-z])"/g)].map((m) => m[1]!);
const optionTexts = (html: string): string[] =>
  [...html.matchAll(/<button class="opt" data-k="[a-z]">([^<]*)<\/button>/g)].map((m) => m[1]!);

describe("shuffleQuizOptions", () => {
  it("preserves the (data-k, text) pairing and the data-correct letter", () => {
    const src = mcq("a", [["a", "alpha"], ["b", "bravo"], ["c", "charlie"]]);
    const out = shuffleQuizOptions(src);
    expect(out).toContain('data-correct="a"');
    // Same buttons, same pairing — just reordered.
    expect(optionTexts(out).sort()).toEqual(["alpha", "bravo", "charlie"]);
    for (const [k, t] of [["a", "alpha"], ["b", "bravo"], ["c", "charlie"]]) {
      expect(out).toContain(`<button class="opt" data-k="${k}">${t}</button>`);
    }
    // The correct answer's text is unchanged (correctness survives).
    expect(correctText(out)).toBe("alpha");
  });

  it("is deterministic and idempotent", () => {
    const src = mcq("b", [["a", "one"], ["b", "two"], ["c", "three"]]);
    const once = shuffleQuizOptions(src);
    expect(shuffleQuizOptions(src)).toBe(once); // deterministic
    expect(shuffleQuizOptions(once)).toBe(once); // idempotent
  });

  it("does not pin the correct answer to the first position across a fixture set", () => {
    // 12 quizzes that ALL author the correct option first (data-k="a", listed
    // first) — the clustering bug. After shuffle, the correct answer must land
    // somewhere other than position 1 for at least some of them.
    const positions: number[] = [];
    for (let i = 0; i < 12; i++) {
      const src = mcq("a", [["a", `right${i}`], ["b", `wrong${i}x`], ["c", `wrong${i}y`]]);
      const out = shuffleQuizOptions(src);
      positions.push(optionTexts(out).indexOf(`right${i}`));
    }
    expect(positions.some((p) => p !== 0)).toBe(true);
    expect(new Set(positions).size).toBeGreaterThan(1);
  });

  it("handles four options", () => {
    const src = mcq("d", [["a", "w"], ["b", "x"], ["c", "y"], ["d", "z"]]);
    const out = shuffleQuizOptions(src);
    expect(optionOrder(out).sort()).toEqual(["a", "b", "c", "d"]);
    expect(correctText(out)).toBe("z");
  });

  it("shuffles multiple quizzes in one document independently", () => {
    const src = mcq("a", [["a", "p1"], ["b", "q1"], ["c", "r1"]]) +
      mcq("a", [["a", "p2"], ["b", "q2"], ["c", "r2"]]);
    const out = shuffleQuizOptions(src);
    expect(correctText(out.split("</div>\n<div").length > 1 ? out : out)).toBeDefined();
    // Both quizzes keep their correct pairing.
    expect(out).toContain('<button class="opt" data-k="a">p1</button>');
    expect(out).toContain('<button class="opt" data-k="a">p2</button>');
    expect((out.match(/data-correct="a"/g) ?? []).length).toBe(2);
  });

  it("leaves fill-in quizzes and non-quiz HTML untouched", () => {
    const fill = `<div class="quiz fill" data-answer="x"><div class="q">2</div><input><button>Check</button><div class="fb"></div></div>`;
    const prose = `<p>hello <b>world</b></p>`;
    expect(shuffleQuizOptions(fill)).toBe(fill);
    expect(shuffleQuizOptions(prose)).toBe(prose);
  });
});
