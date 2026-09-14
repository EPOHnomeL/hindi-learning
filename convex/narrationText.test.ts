import { describe, expect, it } from "vitest";
import { narrationFromHtml } from "./narrationText";

// A lesson body shaped like a real one: the authored `<head>` with its stylesheet,
// prose, and an MCQ quiz card matching the authoring contract (see
// `convex/quizShuffle.test.ts` for the same block).
const lesson = `<!doctype html>
<html><head><title>Hearing God</title>
<style>body { font-family: serif; } .quiz { background: #eee; }</style>
</head>
<body>
<h1>Hearing God</h1>
<p>Prophecy begins with <strong>listening</strong>, not speaking.</p>
<div class="quiz" data-correct="b" data-ok="yes" data-no="no">
  <div class="q">1. What comes first?</div>
  <div class="opts">
    <button class="opt" data-k="a">Speaking</button>
    <button class="opt" data-k="b">Listening</button>
  </div>
  <div class="fb"></div>
</div>
<p>Practise this daily.</p>
<script>console.log("bridge")</script>
</body></html>`;

describe("narrationFromHtml", () => {
  it("keeps the prose and the headings, in order", () => {
    expect(narrationFromHtml(lesson)).toBe(
      ["Hearing God", "Hearing God", "Prophecy begins with listening, not speaking.", "Practise this daily."].join("\n"),
    );
  });

  it("drops the whole quiz card, not just its opening div", () => {
    const out = narrationFromHtml(lesson);
    // The trap: a lazy regex stops at the first `</div>` and leaves the options
    // and feedback behind, so the narrator reads the answers aloud.
    expect(out).not.toContain("What comes first");
    expect(out).not.toContain("Speaking");
    expect(out).not.toContain("Listening,"); // the option, not the word in the prose
  });

  it("never speaks script or style contents", () => {
    const out = narrationFromHtml(lesson);
    expect(out).not.toContain("font-family");
    expect(out).not.toContain("console.log");
  });

  it("decodes the entities that reach plain prose", () => {
    expect(narrationFromHtml("<p>Law &amp; Prophets &nbsp;&quot;listen&quot;</p>")).toBe('Law & Prophets "listen"');
  });

  it("does not split a sentence on inline markup", () => {
    expect(narrationFromHtml("<p>He <em>said</em> it <a href='#'>plainly</a>.</p>")).toBe("He said it plainly.");
  });

  it("breaks paragraphs so the voice pauses where the page does", () => {
    expect(narrationFromHtml("<h2>One</h2><p>Two</p><li>Three</li>")).toBe("One\nTwo\nThree");
  });

  it("drops a quiz card even when its class carries other tokens", () => {
    expect(narrationFromHtml(`<p>Keep</p><div class="card quiz fill" data-answer="x"><p>Drop</p></div>`)).toBe("Keep");
  });

  it("drops the tail rather than half a card when markup is unbalanced", () => {
    expect(narrationFromHtml(`<p>Keep</p><div class="quiz"><p>Drop</p>`)).toBe("Keep");
  });

  it("is empty, not a crash, for an empty body", () => {
    expect(narrationFromHtml("")).toBe("");
  });
});
