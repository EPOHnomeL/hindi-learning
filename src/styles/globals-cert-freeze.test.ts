// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TENANT_THEME_TOKENS } from "../design/tokens";

// The certificate's palette freeze (whitelabel 15) lives as a `.cert-card` token
// reset in globals.css: it re-declares all 14 `--color-*` tokens so the SSR tenant
// override (`:root:root`, issue 11) can't recolour the card. For that to actually
// keep the gold-foil look "visually identical across all four tenants and the
// default site" (acceptance criterion), the frozen values must EQUAL the default
// palette — and cover every token, in both light and dark. A browser confirms the
// rendered result; this pins the source so a new/renamed token can't silently slip
// the freeze, and so no frozen value ever drifts from the default it mirrors.
const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");

// Pull the `--color-*: value;` declarations out of a single `{ … }` rule body.
function parseTokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, tok, val] of block.matchAll(/--color-([\w-]+):\s*([^;]+);/g)) {
    out[tok!] = val!.trim();
  }
  return out;
}

// The rule body immediately following a selector (the `{ … }` up to the first `}`),
// searching from `from` so a repeated selector can be disambiguated by position.
function ruleBody(selector: string, from = 0): string {
  const at = css.indexOf(selector, from);
  expect(at, `selector ${selector} present in globals.css`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("certificate palette freeze", () => {
  const defaultLight = parseTokens(ruleBody("@theme"));
  const defaultDark = parseTokens(ruleBody('html[data-theme="dark"] {'));
  // `.cert-card {` appears twice: the transform block first, then the freeze block
  // (the one carrying `--color-*`). Take the second, then its dark counterpart.
  const firstCard = css.indexOf(".cert-card {");
  const frozenLight = parseTokens(ruleBody(".cert-card {", firstCard + 1));
  const frozenDark = parseTokens(ruleBody('html[data-theme="dark"] .cert-card {'));

  it("freezes every one of the 14 contract tokens, light and dark", () => {
    for (const tok of TENANT_THEME_TOKENS) {
      expect(frozenLight, `light freeze declares --color-${tok}`).toHaveProperty(tok);
      expect(frozenDark, `dark freeze declares --color-${tok}`).toHaveProperty(tok);
    }
    expect(Object.keys(frozenLight).sort()).toEqual([...TENANT_THEME_TOKENS].sort());
    expect(Object.keys(frozenDark).sort()).toEqual([...TENANT_THEME_TOKENS].sort());
  });

  it("frozen values equal the default palette (so the card can't be recoloured)", () => {
    for (const tok of TENANT_THEME_TOKENS) {
      expect(frozenLight[tok], `light --color-${tok}`).toBe(defaultLight[tok]);
      expect(frozenDark[tok], `dark --color-${tok}`).toBe(defaultDark[tok]);
    }
  });
});
