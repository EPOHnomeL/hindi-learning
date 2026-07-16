// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { TENANT_THEME_TOKENS } from "./tokens";

// The 14-token contract, straight from the spec (whitelabel ticket 01 decision 3
// / issue 09). This literal is the independent source of truth the code is
// checked against — it is NOT derived from tokens.ts, so a drop/reorder/rename in
// tokens.ts (or either stylesheet) fails here.
const CONTRACT = [
  "paper", "card", "ink", "soft", "line", "accent", "accent2", "gold",
  "hi", "danger", "good", "good-b", "bad", "bad-b",
];

test("TENANT_THEME_TOKENS is exactly the 14-token contract", () => {
  expect(TENANT_THEME_TOKENS).toHaveLength(14);
  expect([...TENANT_THEME_TOKENS].sort()).toEqual([...CONTRACT].sort());
});

test("globals.css (app chrome) defines every contract token as --color-<t>", () => {
  const css = readFileSync("src/styles/globals.css", "utf8");
  for (const t of CONTRACT) {
    expect(css, `globals.css missing --color-${t}`).toContain(`--color-${t}:`);
  }
});

test("head.html (lessons) defines every contract token as --<t>", () => {
  const html = readFileSync("lessons/_partials/head.html", "utf8");
  for (const t of CONTRACT) {
    // Exact var name + colon, so --good doesn't spuriously match --good-b.
    const re = new RegExp(`--${t.replace(/-/g, "\\-")}\\s*:`);
    expect(html, `head.html missing --${t}`).toMatch(re);
  }
});
