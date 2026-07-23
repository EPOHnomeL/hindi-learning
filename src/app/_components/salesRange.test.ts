import { expect, test } from "vitest";
import { salesRange } from "./salesRange";

const DAY = 86_400_000;
// A fixed instant: 2026-07-23, 14:30 local.
const NOW = new Date(2026, 6, 23, 14, 30, 0).getTime();

// The regression guard for the endless-loading bug: a rolling preset must return
// the SAME window on two renders a moment apart, or `useQuery` keeps re-keying on
// a drifting `from` and never resolves.
test("rolling presets are stable across renders within a day", () => {
  expect(salesRange("30d", "", "", NOW)).toEqual(salesRange("30d", "", "", NOW + 90_000));
  expect(salesRange("7d", "", "", NOW)).toEqual(salesRange("7d", "", "", NOW + 90_000));
});

test("presets anchor to the start of the day", () => {
  const startOfDay = new Date(2026, 6, 23).getTime();
  expect(salesRange("7d", "", "", NOW)).toEqual({ from: startOfDay - 6 * DAY });
  expect(salesRange("30d", "", "", NOW)).toEqual({ from: startOfDay - 29 * DAY });
  expect(salesRange("month", "", "", NOW)).toEqual({ from: new Date(2026, 6, 1).getTime() });
});

test("all time is unbounded; custom is inclusive-from / exclusive end-of-day", () => {
  expect(salesRange("all", "", "", NOW)).toEqual({});
  expect(salesRange("custom", "2026-07-01", "2026-07-15", NOW)).toEqual({
    from: new Date("2026-07-01T00:00:00").getTime(),
    to: new Date("2026-07-15T00:00:00").getTime() + DAY,
  });
  expect(salesRange("custom", "", "", NOW)).toEqual({ from: undefined, to: undefined });
});
