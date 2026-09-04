// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  DEFAULT_TENANT_THEME,
  TENANT_THEME_TOKENS as CONVEX_THEME_TOKENS,
} from "../../convex/tenantTheme";
import { TENANT_THEME_TOKENS, buildTenantThemeCss, deriveDarkFromLight } from "./tokens";

// The emitted dark rule, sliced off its own selector — NOT off the first
// `[data-theme="dark"]` in the string, which is the light block's `:not(…)` gate.
const darkBlockOf = (css: string) => css.slice(css.indexOf(':root:root[data-theme="dark"]'));

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
  expect(css).toContain(":root:root");
  for (const t of CONTRACT) {
    expect(css, `missing --color-${t}`).toContain(`--color-${t}:${LIGHT[t]}`);
  }
});

// Dark mode on a tenant host. The light block's raised specificity ALSO outranks the
// default dark palettes (`html[data-theme="dark"]` in globals.css,
// `:root[data-theme="dark"]` in head.html), so it must exclude the dark document or
// dark mode keeps painting tenant light colours.
test("buildTenantThemeCss scopes the light block out of dark mode", () => {
  const light = buildTenantThemeCss({ light: LIGHT });
  expect(light).toContain(':root:root:not([data-theme="dark"]){');

  // Same gate with the lesson namespace (head.html's dark selector is only
  // `:root[data-theme="dark"]`, which a bare `:root:root` would tie and out-order).
  expect(buildTenantThemeCss({ light: LIGHT }, "")).toContain(':root:root:not([data-theme="dark"]){');
});

// A light-only tenant still gets a BRANDED dark mode (not the shipped warm-brown
// default), derived from its own hues.
test("buildTenantThemeCss derives a dark block for a tenant with no dark palette", () => {
  const dark = darkBlockOf(buildTenantThemeCss({ light: LIGHT }));

  // Surfaces come off the tenant's ink, text off their paper — their pairing, re-lit.
  expect(dark).toContain(`--color-paper:oklch(from ${LIGHT.ink} 0.21 calc(c * 0.55) h)`);
  expect(dark).toContain(`--color-ink:oklch(from ${LIGHT.paper} 0.91 calc(c * 0.6) h)`);
  // Brand hues survive at a lightness that reads on a dark surface.
  expect(dark).toContain(`--color-accent:oklch(from ${LIGHT.accent} 0.74 c h)`);
  // Quiz states are semantics, not brand — left to the default dark palette.
  for (const t of ["good", "good-b", "bad", "bad-b"]) {
    expect(dark, `--color-${t} should fall through to the default dark`).not.toContain(`--color-${t}:`);
  }
});

test("deriveDarkFromLight keeps every derived token in the 14-token contract", () => {
  // No token outside the contract can be emitted — the consumers only read those.
  for (const t of Object.keys(deriveDarkFromLight(LIGHT))) {
    expect(CONTRACT, `derived unknown token ${t}`).toContain(t);
  }
});

test("buildTenantThemeCss with a bare prefix emits --<t> (the lesson-iframe var names)", () => {
  // App chrome reads --color-<t>; the lesson design system (head.html) reads bare
  // --<t>. Same builder, different prefix — so issue 13 rides the same contract.
  const css = buildTenantThemeCss({ light: LIGHT }, "");
  expect(css).toContain(`--paper:${LIGHT.paper}`);
  expect(css).toContain(`--good-b:${LIGHT["good-b"]}`); // hyphenated token
  expect(css).not.toContain("--color-paper");
});

test("buildTenantThemeCss lets an authored dark token beat the derived one", () => {
  const css = buildTenantThemeCss({ light: LIGHT, dark: { paper: "#000000", "good-b": "#00ff00" } });
  expect(css).toContain(':root:root[data-theme="dark"]{');
  const darkBlock = darkBlockOf(css);
  expect(darkBlock).toContain("--color-paper:#000000"); // authored, not the derived oklch()
  expect(darkBlock).not.toContain("--color-paper:oklch");
  expect(darkBlock).toContain("--color-good-b:#00ff00"); // hyphenated token survives
  // A token neither authored nor derived (a quiz state) is still absent, so it falls
  // through to the globals.css default dark via the cascade.
  expect(darkBlock).not.toContain("--color-bad-b:");
});

// ---------------------------------------------------------------------------
// The Convex mirror (technical-foundation 23).
//
// Convex functions cannot import from `src/`, so `convex/tenantTheme.ts` hand-
// mirrors two things that live here: the 14-token list, and the house default
// light palette a freshly-created tenant starts from. A *test* can read across
// that boundary even though the runtime cannot, which is why the mirror is
// guarded here rather than deduplicated into a shared module.
//
// `src/design/tokens.ts` and `src/styles/globals.css` are CANONICAL. If either
// assertion below fails, fix the Convex copy to match, never the other way
// round. Silent drift ships as a colour flash or a wrong brand colour on first
// paint for a freshly created tenant, which is the exact failure the mirror
// exists to prevent.

test("convex/tenantTheme.ts mirrors the canonical token list exactly", () => {
  expect(
    [...CONVEX_THEME_TOKENS],
    "convex/tenantTheme.ts TENANT_THEME_TOKENS has drifted from src/design/tokens.ts. " +
      "src/design/tokens.ts is CANONICAL (Convex cannot import from src/, so the list is " +
      "hand-mirrored); edit the Convex copy to match it.",
  ).toEqual([...TENANT_THEME_TOKENS]);
});

test("convex DEFAULT_TENANT_THEME.light mirrors the globals.css light palette exactly", () => {
  // The `@theme` block is the default light palette every non-tenant surface
  // renders; a new tenant is seeded with a copy of it.
  const css = readFileSync("src/styles/globals.css", "utf8");
  const themeBlock = css.slice(css.indexOf("@theme"), css.indexOf("}", css.indexOf("@theme")));
  const canonical = Object.fromEntries(
    [...themeBlock.matchAll(/--color-([\w-]+):\s*([^;]+);/g)].map(([, tok, val]) => [tok!, val!.trim()]),
  );

  const expected = Object.fromEntries(TENANT_THEME_TOKENS.map((t) => [t, canonical[t]]));
  expect(
    DEFAULT_TENANT_THEME.light,
    "convex/tenantTheme.ts DEFAULT_TENANT_THEME.light has drifted from the light-mode " +
      "--color-* values in src/styles/globals.css. globals.css is CANONICAL; edit the " +
      "Convex copy to match it.",
  ).toEqual(expected);
});
