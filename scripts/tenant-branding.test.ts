import { expect, test } from "vitest";
import { validateTheme } from "./tenant-branding";
import { TENANT_THEME_TOKENS } from "../src/design/tokens";

// A complete, well-formed light palette (all 14 tokens).
const LIGHT = Object.fromEntries(TENANT_THEME_TOKENS.map((t, i) => [t, `#${(i + 1).toString(16).repeat(6).slice(0, 6)}`]));

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
