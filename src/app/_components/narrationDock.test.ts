// @vitest-environment node
import { describe, expect, it, test } from "vitest";
import { carryOver, clock, nextSpeed, parseSpeed, positionState, progress, SPEEDS, speedLabel } from "./narrationDock";

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

describe("carryOver", () => {
  it("lands on the same share of a longer or shorter track", () => {
    // Halfway through a 10 minute reading is halfway through a 12 minute one.
    expect(carryOver(300, 600, 720)).toBe(360);
    expect(carryOver(300, 600, 480)).toBe(240);
  });

  it("starts over when the track being left has no length yet", () => {
    expect(carryOver(30, NaN, 600)).toBe(0);
    expect(carryOver(30, 0, 600)).toBe(0);
  });

  it("starts over when the track being joined has no length yet", () => {
    expect(carryOver(30, 600, NaN)).toBe(0);
    expect(carryOver(30, 600, 0)).toBe(0);
  });

  it("never lands past the end", () => {
    expect(carryOver(700, 600, 480)).toBe(480);
  });
});

// ---- positionState ------------------------------------------------------------

describe("positionState", () => {
  it("says nothing until the duration is a real number", () => {
    expect(positionState(0, NaN, 1)).toBeNull();
    expect(positionState(0, Infinity, 1)).toBeNull();
    expect(positionState(0, 0, 1)).toBeNull();
  });

  it("passes a sane position straight through", () => {
    expect(positionState(134, 552, 1)).toEqual({ duration: 552, position: 134, playbackRate: 1 });
  });

  it("clamps a position a hair past the end, which the API would throw on", () => {
    expect(positionState(552.04, 552, 1)?.position).toBe(552);
  });

  it("falls back to the start and normal speed on garbage", () => {
    expect(positionState(NaN, 552, 0)).toEqual({ duration: 552, position: 0, playbackRate: 1 });
  });
});

// ---- speed ------------------------------------------------------------------

describe("speed", () => {
  it("steps through the owner's list in order and wraps", () => {
    expect(SPEEDS).toEqual([0.8, 1, 1.1, 1.25, 1.33, 1.5, 1.75, 2]);
    expect(nextSpeed(1)).toBe(1.1);
    expect(nextSpeed(1.25)).toBe(1.33);
    expect(nextSpeed(2)).toBe(0.8);
  });

  it("moves an unlisted speed to the next one up", () => {
    expect(nextSpeed(0.75)).toBe(0.8);
    expect(nextSpeed(3)).toBe(0.8);
  });

  it("labels a speed the way the chip shows it", () => {
    expect(speedLabel(1)).toBe("1×");
    expect(speedLabel(0.8)).toBe("0.8×");
    expect(speedLabel(1.33)).toBe("1.33×");
  });

  it("only trusts a stored speed that is on the list", () => {
    expect(parseSpeed("1.5")).toBe(1.5);
    expect(parseSpeed("0.75")).toBe(1);
    expect(parseSpeed(null)).toBe(1);
    expect(parseSpeed("fast")).toBe(1);
  });
});
