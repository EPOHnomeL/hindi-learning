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
