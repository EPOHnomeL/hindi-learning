// @vitest-environment node
import { expect, test } from "vitest";
import { clock, progress } from "./narrationDock";

// The docked narration player's arithmetic (course-narration ticket 01, variant
// B). Both functions are fed straight from an `<audio>` element, which is a
// generous source of garbage: `duration` is NaN until metadata lands, Infinity
// on a stream, and `currentTime` can sit a hair past `duration` at the end.

// ---- clock ------------------------------------------------------------------

test("a lesson-length position reads as minutes and seconds", () => {
  expect(clock(0)).toBe("0:00");
  expect(clock(9)).toBe("0:09");
  expect(clock(134)).toBe("2:14");
  expect(clock(552)).toBe("9:12");
});

test("seconds are floored, never rounded up past the mark", () => {
  // 59.9s must not render "1:00" while the bar still says 59 seconds elapsed.
  expect(clock(59.9)).toBe("0:59");
});

test("an hour-long render still reads, rather than counting past sixty minutes", () => {
  // No lesson is this long today, but a stitched course-wide track would be, and
  // "73:04" is not a time.
  expect(clock(3600)).toBe("1:00:00");
  expect(clock(4384)).toBe("1:13:04");
});

test("the states an audio element reports before it has loaded read as zero", () => {
  // NaN is what `duration` is between `src` being set and `loadedmetadata`, and
  // the dock renders in that window.
  expect(clock(Number.NaN)).toBe("0:00");
  expect(clock(Number.POSITIVE_INFINITY)).toBe("0:00");
  expect(clock(-1)).toBe("0:00");
});

// ---- progress ---------------------------------------------------------------

test("the track fills in proportion to the position", () => {
  expect(progress(0, 552)).toBe(0);
  expect(progress(138, 552)).toBe(0.25);
  expect(progress(552, 552)).toBe(1);
});

test("a position past the end cannot overfill the track", () => {
  // `currentTime` can exceed `duration` by a frame at the end, and a width over
  // 100% paints outside the bar.
  expect(progress(553, 552)).toBe(1);
});

test("an unloaded or zero-length track reads as empty, never NaN", () => {
  // `0/0` is NaN, and `width: NaN%` is an invalid declaration the browser drops,
  // leaving the previous frame's fill on screen.
  expect(progress(0, 0)).toBe(0);
  expect(progress(12, Number.NaN)).toBe(0);
  expect(progress(12, Number.POSITIVE_INFINITY)).toBe(0);
  expect(progress(-1, 552)).toBe(0);
});
