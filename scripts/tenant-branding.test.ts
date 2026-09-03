import { expect, test } from "vitest";
import { validateTheme } from "./tenant-branding";
import { TENANT_THEME_TOKENS } from "../src/design/tokens";

// A complete, well-formed light palette (all 14 tokens). The generated ramp is
// arbitrary, so the two state pairs are overridden with contract-correct values
// (pale surface, saturated border): "well-formed" now includes that relation, and
// a fixture that violated it would fail the very check it is meant to baseline.
const LIGHT = {
  ...Object.fromEntries(TENANT_THEME_TOKENS.map((t, i) => [t, `#${(i + 1).toString(16).repeat(6).slice(0, 6)}`])),
  good: "#e7f3ec",
  "good-b": "#3f8f63",
  bad: "#fbe9e7",
  "bad-b": "#c0573f",
};

test("validateTheme: a complete light palette is valid", () => {
  expect(validateTheme({ light: LIGHT })).toEqual([]);
});

test("validateTheme: an optional partial dark palette is valid", () => {
  expect(validateTheme({ light: LIGHT, dark: { paper: "#111", ink: "#eee" } })).toEqual([]);
});

test("validateTheme: a missing light token is reported", () => {
  const light = { ...LIGHT };
  delete light["gold"];
  expect(validateTheme({ light })).toEqual([expect.stringMatching(/missing.*gold/i)]);
});

test("validateTheme: an unknown token key is reported", () => {
  expect(validateTheme({ light: { ...LIGHT, mystery: "#fff" } })).toEqual([expect.stringMatching(/unknown.*mystery/i)]);
});

test("validateTheme: a pasted CSS declaration (not a bare colour) is rejected", () => {
  // A common mistake: pasting `accent: #2f5d8a;` value-with-semicolon instead of the bare colour.
  expect(validateTheme({ light: { ...LIGHT, accent: "#2f5d8a;" } })).toEqual([
    expect.stringMatching(/accent.*not a valid colour/i),
  ]);
});

test("validateTheme: dark must be an object when present", () => {
  expect(validateTheme({ light: LIGHT, dark: "nope" })).toEqual([expect.stringMatching(/dark.*must be an object/i)]);
});

test("validateTheme: missing light entirely is reported", () => {
  expect(validateTheme({})).toEqual([expect.stringMatching(/light is required/i)]);
});

test("validateTheme: accepts rgb()/hsl() colour forms", () => {
  const light = { ...LIGHT, accent: "rgb(47, 93, 138)", gold: "hsl(40 70% 50%)" };
  expect(validateTheme({ light })).toEqual([]);
});

// The inversion that shipped: docs/agents/tenant-branding.md's own worked example
// had both pairs the wrong way round, all four seeded tenants copied it, and the
// live lesson reader rendered a correct answer as dark-on-dark (2026-09-03).
test("validateTheme: a swapped good/good-b pair is rejected", () => {
  const light = { ...LIGHT, good: "#3f7d54", "good-b": "#cfe6d6" };
  expect(validateTheme({ light })).toEqual([expect.stringMatching(/good.*swapped/is)]);
});

test("validateTheme: a swapped bad/bad-b pair is rejected", () => {
  const light = { ...LIGHT, bad: "#c0432f", "bad-b": "#f2d6cf" };
  expect(validateTheme({ light })).toEqual([expect.stringMatching(/bad.*swapped/is)]);
});

test("validateTheme: the exact palette seeded for all four tenants is rejected", () => {
  const light = { ...LIGHT, good: "#3f7d54", "good-b": "#cfe6d6", bad: "#c0432f", "bad-b": "#f2d6cf" };
  expect(validateTheme({ light })).toHaveLength(2);
});

test("validateTheme: a dark palette is exempt, its surface is legitimately darker", () => {
  // The shipped dark theme is `--good:#1e3328` behind `--good-b:#74cf9b`.
  expect(validateTheme({ light: LIGHT, dark: { good: "#1e3328", "good-b": "#74cf9b" } })).toEqual([]);
});

test("validateTheme: a non-hex state colour skips the check rather than guessing", () => {
  const light = { ...LIGHT, good: "oklch(0.95 0.03 150)", "good-b": "oklch(0.6 0.12 150)" };
  expect(validateTheme({ light })).toEqual([]);
});
