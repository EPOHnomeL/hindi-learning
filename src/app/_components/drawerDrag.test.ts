import { expect, test } from "vitest";
import { dragOffset, shouldDismiss } from "./drawerDrag";

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
