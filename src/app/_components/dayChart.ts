// Pure model for the admin day-bucketed stacked column charts (dataviz skill):
// the Generation activity graph and the Sales-by-day graph. Kept out of the
// component so the axis maths is testable without a DOM.

// A "nice" top of the count axis: the smallest 1/2/5 × 10^k at or above the
// tallest column, so ticks are round numbers (0 / 5 / 10) instead of the raw
// data max. Small counts get an even bound so the mid tick is a whole number.
export function niceMax(max: number): number {
  if (max <= 1) return 1;
  if (max <= 2) return 2;
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 5]) {
    if (step * pow >= max) return step * pow;
  }
  return 10 * pow;
}

// The tick values for that axis, top-down: the bound, its half when that is a
// whole number, and zero. Two ticks (bound + zero) whenever a mid tick would be
// fractional — a "2.5 sales" gridline reads as a data claim it isn't.
export function axisTicks(top: number): number[] {
  return top >= 2 && top % 2 === 0 ? [top, top / 2, 0] : [top, 0];
}

// Which column indices carry an x-axis date label: evenly spaced, at most
// `maxLabels`, always including the first and last. A 30-day axis gets ~5 dates
// instead of the 3 it had — dense enough to place a spike, sparse enough that
// the labels never collide.
export function labelIndices(len: number, maxLabels = 5): number[] {
  if (len <= 0) return [];
  if (len <= maxLabels) return [...Array(len).keys()];
  const step = (len - 1) / (maxLabels - 1);
  return [...new Set([...Array(maxLabels).keys()].map((i) => Math.round(i * step)))];
}
