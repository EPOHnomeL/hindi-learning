// The whitelabel design-token contract (ticket 01 / issue 09). This is the ONE
// canonical list of the 14 semantic tokens every surface reads from — app chrome
// (Tailwind `@theme`, `--color-<t>` prefix, src/styles/globals.css), lessons
// (bare `--<t>` prefix, lessons/_partials/head.html), invite email, certificate.
// A tenant theme (ticket 03) is nothing more than an override of these tokens;
// keeping the set defined here means the override rides one contract, not three.
//
// Semantics (so tenant design systems and the lesson injection in issue 13 agree
// with how head.html already uses them):
//   paper   page background        card    raised surface (cards, verses, quiz)
//   ink     primary text           soft    muted / secondary text
//   line    hairline borders       accent  primary brand (links, kickers)
//   accent2 secondary brand        gold    highlight / ornament
//   hi      highlight-mark bg      danger  error text / destructive
//   good    correct-answer surface good-b  correct-answer border/accent
//   bad     wrong-answer surface   bad-b   wrong-answer border/accent
export const TENANT_THEME_TOKENS = [
  "paper", "card", "ink", "soft", "line", "accent", "accent2", "gold",
  "hi", "danger", "good", "good-b", "bad", "bad-b",
] as const;

export type Token = (typeof TENANT_THEME_TOKENS)[number];

// A tenant's palette override: light is required and complete (all 14); dark is
// optional and may be partial (unspecified tokens fall back to the default dark
// palette). Hyphenated token names (`good-b`, `bad-b`) are why the Convex-side
// theme validator stays a loose record rather than a fixed object — the exact
// key set is enforced in code (see convex/tenants.ts assertThemeTokens, which
// mirrors this list because Convex functions can't import from src/).
export type TenantTheme = {
  light: Record<Token, string>;
  dark?: Partial<Record<Token, string>>;
};

// The pure seam behind the tenant palette overrides (issue 11's SSR no-flash
// <style> for app chrome; issue 13's lesson-iframe injection). Turn a tenant
// palette into the CSS var overrides the consumer injects. The string it builds is
// pinned in tokens.test.ts; the rendered result is verified in a browser.
//
// `prefix` selects the var namespace: `"color-"` (default) for app chrome, which
// reads `--color-<t>` (Tailwind `@theme`, globals.css); `""` for the lesson design
// system, which reads bare `--<t>` (head.html). Same 14-token contract, one builder.
//
// Dark mode keeps the tenant's BRAND rather than falling back to the shipped warm
// palette: a navy tenant in dark mode was rendering as the default brown/orange
// skin, which reads as someone else's brand. `deriveDarkFromLight` re-lights the
// tenant's own hues for a dark surface (below); any token the tenant authored in
// `theme.dark` is emitted after the derived ones, in the same block, so an authored
// value still wins. The 4 quiz-state tokens stay unset and fall through to the
// default dark palette — right/wrong colours are semantics, not brand.
//
// The light block is gated on `:not([data-theme="dark"])` — WITHOUT it, that same
// raised specificity also beat the DEFAULT dark palettes (globals.css's
// `html[data-theme="dark"]`, head.html's `:root[data-theme="dark"]`), so on a tenant
// host dark mode kept painting the tenant's LIGHT colours for every token the tenant
// hadn't overridden in dark — and broke entirely for a tenant with no dark palette.
// Gating makes the documented "tenant dark, else default dark" fall-through real:
// in dark mode the light block simply doesn't apply.
export function buildTenantThemeCss(theme: TenantTheme, prefix = "color-"): string {
  const decls = (palette: Partial<Record<Token, string>>) =>
    TENANT_THEME_TOKENS.filter((tok) => palette[tok] != null)
      .map((tok) => `--${prefix}${tok}:${palette[tok]}`)
      .join(";");

  const dark = { ...deriveDarkFromLight(theme.light), ...theme.dark };
  return (
    `:root:root:not([data-theme="dark"]){${decls(theme.light)}}` +
    `:root:root[data-theme="dark"]{${decls(dark)}}`
  );
}

// Re-light a tenant's light palette for the dark surface, keeping its hues. Pure
// CSS relative-color syntax (`oklch(from <color> L C H)`) rather than a colour
// library: the browser does the conversion and gamut-mapping, so this stays a
// string builder with no dependency and no maths to get wrong. OKLCH (not HSL)
// because its lightness is perceptual — one L target reads evenly across hues.
//
// The mapping, and why each one:
//   paper/card/line ← the tenant's INK, the darkest neutral they already chose, so
//     the page is a deep version of their own brand colour (navy brand → navy-black
//     page) instead of the shipped warm brown. Chroma is pulled back so a large
//     surface stays a near-neutral, not a saturated wash.
//   ink  ← their light PAPER, held bright: the light mode's paper cream becomes the
//     dark mode's text, so the pairing stays theirs in both directions.
//   soft ← their soft, lifted to read as muted-but-legible on a dark surface.
//   accent/accent2/gold ← their brand hues at a lightness that has contrast against
//     the dark paper. A dark-on-light brand colour (ywampotch's #1b2a80 navy) is
//     unreadable on a dark page as-is; raising L keeps the hue and makes it legible.
//   hi ← a dark tint of their GOLD, mirroring how the default dark palette derives
//     its highlight-mark background from its own ornament colour.
//
// The lightness targets are the SHIPPED dark palette's own measured L values
// (paper .211, card .243, line .323, ink .913, soft .701, gold .766, hi .364), so a
// derived skin sits at the depth the design already reads as dark — only the hue is
// the tenant's. `accent2` is pulled below `accent` because a brand whose two accents
// share a hue (ywampotch's navy pair) collapses into one colour once both are
// re-lit. Chroma is scaled down on the large surfaces only: the shipped dark
// surfaces are near-neutral (C ≤ .018), and a full-chroma brand hue across a whole
// page reads as a colour wash rather than as a dark surface. Checked against all
// four seeded tenants: every text token clears WCAG AA (≥ 4.5:1) on its own derived
// paper, and a monochrome brand (Almighty Warriors) stays monochrome.
//
// Unsupported relative colour syntax (pre-2023 browsers) makes each declaration
// invalid-at-computed-value, so it drops to the default dark palette underneath —
// degrading to the old behaviour rather than to nothing.
export function deriveDarkFromLight(light: Record<Token, string>): Partial<Record<Token, string>> {
  const relight = (from: string, l: number, chroma = 1) =>
    `oklch(from ${from} ${l} ${chroma === 1 ? "c" : `calc(c * ${chroma})`} h)`;

  return {
    paper: relight(light.ink, 0.21, 0.55),
    card: relight(light.ink, 0.245, 0.55),
    line: relight(light.ink, 0.325, 0.5),
    ink: relight(light.paper, 0.91, 0.6),
    soft: relight(light.soft, 0.7),
    accent: relight(light.accent, 0.74),
    accent2: relight(light.accent2, 0.68),
    gold: relight(light.gold, 0.77),
    hi: relight(light.gold, 0.36, 0.7),
    danger: relight(light.danger, 0.69),
  };
}
