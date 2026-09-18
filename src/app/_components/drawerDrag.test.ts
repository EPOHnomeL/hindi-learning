import { expect, test } from "vitest";
import {
  BOUNCY_FLICK,
  FLICK,
  decideDismiss,
  dragOffset,
  releaseVelocity,
  rubberband,
  sheetOffset,
  shouldDismiss,
} from "./drawerDrag";

test("dragging down moves the drawer down; dragging up moves nothing", () => {
  // A downward drag is the distance travelled, so the sheet follows the finger.
  expect(dragOffset(500, 560)).toBe(60);
  // Upward is clamped: the drawer is already at its rest height and must not
  // rise past it, which would tear a gap under the sheet.
  expect(dragOffset(500, 420)).toBe(0);
  expect(dragOffset(500, 500)).toBe(0);
});

test("release past a quarter of the sheet closes it, short of that snaps back", () => {
  // 600px sheet: the quarter mark is 150, above the 80px floor.
  expect(shouldDismiss(151, 600)).toBe(true);
  expect(shouldDismiss(149, 600)).toBe(false);
});

test("a short sheet still needs a deliberate drag, not a tap-wobble", () => {
  // A quarter of a 200px sheet is 50px, which a thumb wobble clears by accident,
  // so the 80px floor wins on short sheets.
  expect(shouldDismiss(60, 200)).toBe(false);
  expect(shouldDismiss(81, 200)).toBe(true);
});

test("rubberband gives diminishing travel that never reaches the dimension", () => {
  expect(rubberband(0, 600)).toBe(0);
  // 100px of overshoot on a 600px sheet moves it about 50px.
  expect(rubberband(100, 600)).toBeCloseTo(50.38, 1);
  // Monotonic and bounded: pulling forever approaches the sheet's height.
  expect(rubberband(200, 600)).toBeGreaterThan(rubberband(100, 600));
  expect(rubberband(1_000_000, 600)).toBeLessThan(600);
});

test("sheetOffset follows the finger down 1:1 and rubber-bands above rest", () => {
  expect(sheetOffset(500, 560, 600)).toBe(60);
  expect(sheetOffset(500, 500, 600)).toBe(0);
  // Pulling up 100px lifts the sheet only about 50px, and reads as negative
  // (above rest) so the caller can render it as such.
  expect(sheetOffset(500, 400, 600)).toBeCloseTo(-50.38, 1);
});

test("a flick decides by velocity before position", () => {
  // Barely moved but flung down: dismiss.
  expect(decideDismiss(10, 600, FLICK + 1)).toBe(true);
  // Pulled most of the way but flung back up: stays open.
  expect(decideDismiss(500, 600, -(FLICK + 1))).toBe(false);
  // A slow release falls back to the quarter-height rule.
  expect(decideDismiss(151, 600, 0)).toBe(true);
  expect(decideDismiss(149, 600, 0)).toBe(false);
  expect(decideDismiss(149, 600, FLICK - 1)).toBe(false);
});

test("release velocity is measured over the last stretch of the gesture, in px/s", () => {
  // 50px in 100ms downward is 500px/s.
  expect(releaseVelocity([{ y: 0, t: 0 }, { y: 50, t: 100 }])).toBe(500);
  // Upward is negative.
  expect(releaseVelocity([{ y: 50, t: 0 }, { y: 0, t: 100 }])).toBe(-500);
  // A finger that stopped and rested before letting go has no velocity: samples
  // older than the window are dropped, so the early fast stretch does not count.
  expect(releaseVelocity([{ y: 0, t: 0 }, { y: 300, t: 50 }, { y: 300, t: 400 }, { y: 300, t: 500 }])).toBe(0);
  // Too few samples, or no time elapsed, is zero rather than NaN or Infinity.
  expect(releaseVelocity([{ y: 10, t: 0 }])).toBe(0);
  expect(releaseVelocity([])).toBe(0);
  expect(releaseVelocity([{ y: 0, t: 5 }, { y: 30, t: 5 }])).toBe(0);
});

test("the thresholds are ordered: a bouncy flick is faster than a deciding flick", () => {
  expect(BOUNCY_FLICK).toBeGreaterThan(FLICK);
});
