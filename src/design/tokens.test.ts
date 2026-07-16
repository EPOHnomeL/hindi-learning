// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { TENANT_THEME_TOKENS, buildTenantThemeCss } from "./tokens";

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

// buildTenantThemeCss — the pure seam behind the SSR no-flash <style> (issue 11).
// The layout wiring is verified in-browser; here we pin the CSS it emits.

const LIGHT = Object.fromEntries(CONTRACT.map((t, i) => [t, `#${String(i).padStart(6, "0")}`])) as Record<
  string,
  string
>;

test("buildTenantThemeCss emits all 14 light tokens as --color-<t> under a specificity-doubled :root", () => {
  const css = buildTenantThemeCss({ light: LIGHT });
  // `:root:root` (not a bare `:root`) so the override beats Tailwind's @theme :root
  // regardless of stylesheet source order.
  expect(css).toContain(":root:root{");
  for (const t of CONTRACT) {
    expect(css, `missing --color-${t}`).toContain(`--color-${t}:${LIGHT[t]}`);
  }
  // A palette with no dark emits no dark block — the globals default dark governs.
  expect(css).not.toContain('data-theme="dark"');
});

test("buildTenantThemeCss emits a dark block with ONLY the tenant's partial dark tokens", () => {
  const css = buildTenantThemeCss({ light: LIGHT, dark: { paper: "#000000", "good-b": "#00ff00" } });
  expect(css).toContain(':root:root[data-theme="dark"]{');
  const darkBlock = css.slice(css.indexOf('[data-theme="dark"]'));
  expect(darkBlock).toContain("--color-paper:#000000");
  expect(darkBlock).toContain("--color-good-b:#00ff00"); // hyphenated token survives
  // Tokens absent from the tenant's dark palette are NOT emitted (they fall through
  // to the globals.css default dark via the cascade).
  expect(darkBlock).not.toContain("--color-ink:");
});
