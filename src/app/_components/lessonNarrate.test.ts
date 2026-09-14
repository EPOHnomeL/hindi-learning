// @vitest-environment node
import { expect, test } from "vitest";
import { buildSrcDoc, lessonMessage, narrateMessage } from "./lessonSrcDoc";

// The in-lesson narration control (AI voice pilot, 2026-09-14). The control is a
// script injected into a sandboxed iframe, so what is testable here is the seam
// either side of it: whether the document carries the control at all, and whether
// the two messages that join it to the parent are well formed.

const LESSON = `<!doctype html><html><head><title>T</title></head><body>
<header class="lesson"><div class="kicker">Unit 1</div><h1>Hearing God</h1><p class="sub">and learning to wait</p></header>
<p>Body.</p>
</body></html>`;

const build = (narrate: boolean) => buildSrcDoc(LESSON, { quiz: true, narrate });

// ---- presence is the server's verdict, not a CSS trick -----------------------

test("outside the pilot the document carries no trace of the control", () => {
  const doc = build(false);
  // Not "hidden", not "display:none": absent. A learner's document must not ship
  // a button that only a stylesheet is keeping off the screen.
  expect(doc).not.toContain("narrate");
  expect(doc).not.toContain("Listen to this lesson");
});

test("inside the pilot the document carries the control and its skin", () => {
  const doc = build(true);
  expect(doc).toContain("narrate-btn");
  expect(doc).toContain("Listen to this lesson");
  // The skin goes in <head>, ahead of the body it styles.
  expect(doc.indexOf(".narrate-btn{")).toBeLessThan(doc.indexOf("</head>"));
});

test("the control is injected once, not once per bridge", () => {
  const doc = build(true);
  expect(doc.split("narrate-btn'").length - 1).toBeGreaterThan(0);
  // One <style> block and one bridge script, however many other bridges are on.
  expect(doc.split("@keyframes narrate-spin").length - 1).toBe(1);
});

test("the lesson's own bridges still land alongside it", () => {
  // The narration bridge is appended to the same script bundle as the others, so
  // a regression that drops height or quiz capture would show up here.
  const doc = build(true);
  expect(doc).toContain("type:'height'");
  expect(doc).toContain("type:'response'");
});

// ---- the two messages -------------------------------------------------------

test("a press parses as a payload-free narrate message from this frame", () => {
  const frame = {} as Window;
  const e = { source: frame, data: { __lesson: true, type: "narrate" } } as MessageEvent;
  expect(lessonMessage(e, frame)).toEqual({ type: "narrate" });
});

test("a press from ANOTHER frame is refused", () => {
  // The whole reason `lessonMessage` takes the trusted frame: any frame on the
  // page could otherwise ask the app to spend money on a render.
  const e = { source: {} as Window, data: { __lesson: true, type: "narrate" } } as MessageEvent;
  expect(lessonMessage(e, {} as Window)).toBeNull();
});

test("a press with no lesson marker is refused", () => {
  const frame = {} as Window;
  const e = { source: frame, data: { type: "narrate" } } as MessageEvent;
  expect(lessonMessage(e, frame)).toBeNull();
});

test("the parent's state message is tagged so the control ignores everything else", () => {
  expect(narrateMessage("playing")).toEqual({ __lessonNarrate: true, state: "playing", message: "" });
  expect(narrateMessage("idle", "No.")).toEqual({ __lessonNarrate: true, state: "idle", message: "No." });
});

test("the state message is NOT a lesson message, so it cannot round-trip inward", () => {
  // Outbound (parent to frame) and inbound (frame to parent) are different
  // protocols on purpose; feeding one into the other's parser must yield nothing.
  const frame = {} as Window;
  const e = { source: frame, data: narrateMessage("playing") } as MessageEvent;
  expect(lessonMessage(e, frame)).toBeNull();
});
