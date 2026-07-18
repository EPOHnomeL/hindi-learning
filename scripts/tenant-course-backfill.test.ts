import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { BAKE_SENTINEL, bakeTenantPalette, buildSubstitutions, extractRootPalette } from "./tenant-course-backfill";
import { TENANT_THEME_TOKENS } from "../src/design/tokens";

// The real design system — the bake's single source of truth for "default".
const HEAD_HTML = readFileSync("lessons/_partials/head.html", "utf8");
const DEFAULTS = extractRootPalette(HEAD_HTML);

test("extractRootPalette: pulls all 14 light tokens from head.html", () => {
  for (const tok of TENANT_THEME_TOKENS) {
    expect(DEFAULTS.light[tok], `light --${tok}`).toMatch(/^#[0-9a-f]{6}$/i);
  }
  // Known anchors from head.html's :root{} block.
  expect(DEFAULTS.light["line"]).toBe("#e7ddd4");
  expect(DEFAULTS.light["accent"]).toBe("#9c5b34");
});

test("extractRootPalette: pulls the dark palette from the bare dark :root, not the scoped selectors", () => {
  expect(DEFAULTS.dark["paper"]).toBe("#1b1815");
  expect(DEFAULTS.dark["accent"]).toBe("#dd9863");
  // `--book`/`--book-bg` exist in head.html but aren't tenant tokens — excluded.
  expect(DEFAULTS.light["book" as keyof typeof DEFAULTS.light]).toBeUndefined();
});

const TENANT: { light: Record<string, string>; dark?: Record<string, string> } = {
  light: Object.fromEntries(TENANT_THEME_TOKENS.map((t, i) => [t, `#${(i + 10).toString(16).repeat(6).slice(0, 6)}`])),
};

test("buildSubstitutions: one swap per token whose tenant value differs from the default", () => {
  const subs = buildSubstitutions(DEFAULTS, TENANT);
  // Every token differs from the default here, so all 14 are present.
  expect(subs).toHaveLength(14);
  expect(subs).toContainEqual({ from: DEFAULTS.light["line"]!, to: TENANT.light["line"]! });
});

test("buildSubstitutions: a token equal to the default is dropped (no no-op swap)", () => {
  const theme = { light: { ...TENANT.light, line: DEFAULTS.light["line"]! } };
  const subs = buildSubstitutions(DEFAULTS, theme);
  expect(subs.some((s) => s.from.toLowerCase() === DEFAULTS.light["line"]!.toLowerCase())).toBe(false);
});

test("buildSubstitutions: dark swaps only when the tenant overrides dark", () => {
  const lightOnly = buildSubstitutions(DEFAULTS, TENANT);
  const withDark = buildSubstitutions(DEFAULTS, { light: TENANT.light, dark: { paper: "#000000" } });
  expect(withDark.length).toBe(lightOnly.length + 1);
  expect(withDark).toContainEqual({ from: DEFAULTS.dark["paper"]!, to: "#000000" });
});

test("bakeTenantPalette: repaints BOTH the :root var decl and the hardcoded literals of a default token", () => {
  const subs = buildSubstitutions(DEFAULTS, TENANT);
  const { html, baked } = bakeTenantPalette(HEAD_HTML, subs);
  expect(baked).toBe(true);
  // The default --line (#e7ddd4) is used both as a var value AND hardcoded in
  // `border-bottom:1px solid #e7ddd4` — the bake must catch every occurrence.
  expect(html).not.toContain(DEFAULTS.light["line"]!);
  expect(html).toContain(`--line:${TENANT.light["line"]}`);
  expect(html).toContain(`border-bottom:1px solid ${TENANT.light["line"]}`);
});

test("bakeTenantPalette: an 8-digit hex (colour + alpha) keeps its alpha suffix", () => {
  // head.html has `box-shadow:0 2px 14px #b88a2e10` — the default --gold + "10".
  const subs = buildSubstitutions(DEFAULTS, TENANT);
  const { html } = bakeTenantPalette(HEAD_HTML, subs);
  expect(html).toContain(`${TENANT.light["gold"]}10`);
});

test("bakeTenantPalette: is idempotent — a second run is a skipped no-op", () => {
  const subs = buildSubstitutions(DEFAULTS, TENANT);
  const once = bakeTenantPalette(HEAD_HTML, subs);
  const twice = bakeTenantPalette(once.html, subs);
  expect(twice.baked).toBe(false);
  expect(twice.html).toBe(once.html);
  // Exactly one sentinel — never double-stamped.
  expect(once.html.split(BAKE_SENTINEL)).toHaveLength(2);
});

test("bakeTenantPalette: no-swap tenant (palette equals default) still stamps, so it's marked done", () => {
  const { html, baked } = bakeTenantPalette("<html><head></head><body>hi</body></html>", []);
  expect(baked).toBe(true);
  expect(html.endsWith(BAKE_SENTINEL)).toBe(true);
});

test("bakeTenantPalette: does not re-map a tenant value that collides with another token's default", () => {
  // tenant maps default A (#aaaaaa) → B's default value (#bbbbbb), and default B
  // (#bbbbbb) → #cccccc. A single left-to-right pass must NOT turn the freshly
  // written #bbbbbb back into #cccccc.
  const subs = [
    { from: "#aaaaaa", to: "#bbbbbb" },
    { from: "#bbbbbb", to: "#cccccc" },
  ];
  const { html } = bakeTenantPalette("x #aaaaaa y", subs);
  expect(html).toContain("#bbbbbb");
  expect(html).not.toContain("#cccccc");
});
