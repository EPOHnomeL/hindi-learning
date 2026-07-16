import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertAdmin } from "./lib";
import { tenantFlagsValidator, tenantThemeValidator } from "./schema";

// The 14-token whitelabel palette contract (ticket 01 / 03). A tenant's
// `theme.light` must define all of these and nothing else; `theme.dark` may
// define a partial subset (the rest fall back to the default dark palette). The
// Convex validator keeps `light`/`dark` as loose records (hyphenated names like
// good-b can't be v.object keys), so the exact key set is enforced here in code.
// ponytail: issue 09 mints the frontend src/design/tokens.ts as the single
// source of truth — convex can't import from src/, so this list mirrors it;
// keep the two in sync (or have 09 re-export a convex-side copy) when 09 lands.
export const TENANT_THEME_TOKENS = [
  "paper", "card", "ink", "soft", "line", "accent", "accent2", "gold",
  "hi", "danger", "good", "good-b", "bad", "bad-b",
] as const;

function assertThemeTokens(theme: { light: Record<string, string>; dark?: Record<string, string> }) {
  const known = new Set<string>(TENANT_THEME_TOKENS);

  const unknownLight = Object.keys(theme.light).filter((k) => !known.has(k));
  if (unknownLight.length) throw new Error(`theme.light has unknown token(s): ${unknownLight.join(", ")}`);
  const missing = TENANT_THEME_TOKENS.filter((tok) => !(tok in theme.light));
  if (missing.length) throw new Error(`theme.light is missing required token(s): ${missing.join(", ")}`);

  if (theme.dark) {
    const unknownDark = Object.keys(theme.dark).filter((k) => !known.has(k));
    if (unknownDark.length) throw new Error(`theme.dark has unknown token(s): ${unknownDark.join(", ")}`);
    // dark is intentionally partial — no missing-token check.
  }
}

// Seed one tenant row, idempotently (issue 07). PUBLISH_SECRET-guarded like the
// other operator-script mutations; the seed driver (scripts/seed-tenants.ts)
// calls it once per tenant with the mock-palette fixtures. Skips a slug that
// already exists — never duplicates, never overwrites — so re-running the seed
// is safe. Tenant *admin* assignment (marking whitelist rows) is a separate
// operator action with real emails; this only creates tenant rows.
export const seedTenant = mutation({
  args: {
    secret: v.string(),
    slug: v.string(),
    displayName: v.string(),
    theme: tenantThemeValidator,
    flags: tenantFlagsValidator,
  },
  returns: v.object({ created: v.boolean() }),
  handler: async (ctx, { secret, slug, displayName, theme, flags }) => {
    assertAdmin(secret);
    assertThemeTokens(theme);

    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) return { created: false };

    await ctx.db.insert("tenants", { slug, displayName, theme, flags });
    return { created: true };
  },
});
