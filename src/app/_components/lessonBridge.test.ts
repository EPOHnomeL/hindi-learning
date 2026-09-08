// @vitest-environment node
import { readFileSync } from "node:fs";
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

// ---- what crosses the boundary: the one breakpoint (ticket 37) ------------------

test("the injected justify block sets 768px AND unsets the 641 to 767 band", async () => {
  // The trap ticket 37 exists to document. The injected block lands immediately
  // before `</head>`, AFTER the copy baked into every already-published lesson's
  // stored HTML, and that baked copy says 641px. Published lessons are immutable
  // (ADR 0003; 441 of them on prod, measured 2026-09-07), so raising the injected
  // rule to 768px on its own changes nothing between 641px and 767px: the baked
  // rule still matches there and nothing overrides it.
  //
  // So both rules must be present. Delete the second one and this fails, which is
  // the only thing standing between "looks correct" and "does nothing on the 441
  // lessons that matter".
  const { buildSrcDoc } = await import("./lessonSrcDoc");
  const stored = `<!DOCTYPE html><html><head><style>@media (min-width: 641px){.wrap p{text-align:justify; hyphens:auto}}</style></head><body><div class="wrap"><p>x</p></div></body></html>`;
  const doc = buildSrcDoc(stored, { quiz: true });

  expect(doc).toContain("@media (min-width: 768px){.wrap p{text-align:justify; hyphens:auto}}");
  expect(doc).toContain("@media (min-width: 641px) and (max-width: 767.98px){.wrap p{text-align:start; hyphens:manual}}");
  // And the injected pair comes AFTER the baked rule, which is what lets it win
  // on source order at equal specificity.
  expect(doc.lastIndexOf("min-width: 641px){.wrap p{text-align:justify")).toBeLessThan(
    doc.indexOf("min-width: 768px){.wrap p{text-align:justify"),
  );
});

test("the unset uses a logical alignment, so an RTL Edition is not pinned left", async () => {
  const { buildSrcDoc } = await import("./lessonSrcDoc");
  const doc = buildSrcDoc("<p>x</p>", { quiz: true });
  expect(doc).toContain("text-align:start");
  expect(doc).not.toContain("text-align:left; hyphens:manual");
});

test("the partials carry the one breakpoint too, for lessons published from now on", () => {
  // These cannot reach the 441 already stored, whose HTML is immutable, which is
  // why the injected pair above exists at all.
  const head = readFileSync("lessons/_partials/head.html", "utf8");
  const refHead = readFileSync("lessons/_partials/reference-head.html", "utf8");
  for (const [name, css] of [
    ["head.html", head],
    ["reference-head.html", refHead],
  ] as const) {
    expect(css, `${name} must not carry a 640/641 breakpoint`).not.toMatch(/(min|max)-width:\s*64[01]px/);
  }
  expect(head).toContain("@media (min-width: 768px){ .wrap p{text-align:justify; hyphens:auto} }");
});
