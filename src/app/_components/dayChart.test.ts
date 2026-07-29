import { expect, test } from "vitest";
import { axisTicks, labelIndices, niceMax } from "./dayChart";

test("the axis top is the next round 1/2/5 above the data max", () => {
  expect(niceMax(0)).toBe(1); // an all-zero window still needs a scale
  expect(niceMax(1)).toBe(1);
  expect(niceMax(3)).toBe(4);
  expect(niceMax(7)).toBe(10);
  expect(niceMax(12)).toBe(20);
  expect(niceMax(41)).toBe(50);
  expect(niceMax(100)).toBe(100);
  expect(niceMax(101)).toBe(200);
});

test("ticks carry a mid gridline only when it is a whole number", () => {
  expect(axisTicks(10)).toEqual([10, 5, 0]);
  expect(axisTicks(4)).toEqual([4, 2, 0]);
  expect(axisTicks(1)).toEqual([1, 0]); // 0.5 sales is not a thing
});

test("date labels are evenly spaced and always include both ends", () => {
  expect(labelIndices(0)).toEqual([]);
  expect(labelIndices(3)).toEqual([0, 1, 2]); // short axes label every column
  const thirty = labelIndices(30);
  expect(thirty).toEqual([0, 7, 15, 22, 29]);
  expect(thirty[0]).toBe(0);
  expect(thirty.at(-1)).toBe(29);
  expect(labelIndices(365).length).toBe(5);
});
