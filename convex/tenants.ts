import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertAdmin } from "./lib";
import { assertEmblemImage } from "./emblem";
import { isCallerAdmin } from "./whitelist";
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

// Overwrite an existing tenant's palette (the update path seedTenant deliberately
// refuses — it's create-only for idempotent re-seeds). PUBLISH_SECRET-guarded like
// seedTenant, so the operator scripts can repaint a tenant without an authed
// session; the dashboard (ticket 20) will drive the same write through an identity
// guard later. Replaces `light` (and `dark` if given; a missing `dark` clears any
// stale dark so it falls back to the default). Brand assets are preserved — this
// touches the palette only, never the logo/favicon storage ids.
export const setTenantTheme = mutation({
  args: {
    secret: v.string(),
    slug: v.string(),
    theme: tenantThemeValidator,
  },
  returns: v.null(),
  handler: async (ctx, { secret, slug, theme }) => {
    assertAdmin(secret);
    assertThemeTokens(theme);

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!tenant) throw new Error("tenant not found");

    const next: typeof tenant.theme = { light: theme.light };
    if (theme.dark) next.dark = theme.dark;
    if (tenant.theme.logo) next.logo = tenant.theme.logo;
    if (tenant.theme.favicon) next.favicon = tenant.theme.favicon;
    await ctx.db.patch(tenant._id, { theme: next });
    return null;
  },
});

// Resolve everything the frontend needs about a tenant, by slug (issue 11). One
// indexed `by_slug` read serves all three consumers, so they never drift:
//   - the SSR no-flash <style> in the root layout reads `theme` (the palette),
//   - `generateMetadata` reads `faviconUrl`,
//   - the client tenant context reads `displayName`, `logoUrl`, `flags`.
// Public by design: a resolved slug only selects a skin (ADR 0021 §6) and all of
// this is served on anonymous pages anyway; privileged actions stay guarded by
// identity elsewhere. Returns `null` for an unknown slug (the default site), so
// callers treat "no tenant" and "not found" the same. Storage ids are surfaced as
// resolved urls (logo/favicon); the returned `theme` is palette-only.
export const getTheme = query({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      displayName: v.string(),
      theme: v.object({
        light: v.record(v.string(), v.string()),
        dark: v.optional(v.record(v.string(), v.string())),
      }),
      logoUrl: v.union(v.string(), v.null()),
      faviconUrl: v.union(v.string(), v.null()),
      flags: tenantFlagsValidator,
    }),
  ),
  handler: async (ctx, { slug }) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!tenant) return null;

    const { light, dark, logo, favicon } = tenant.theme;
    return {
      displayName: tenant.displayName,
      theme: dark ? { light, dark } : { light },
      logoUrl: logo ? await ctx.storage.getUrl(logo) : null,
      faviconUrl: favicon ? await ctx.storage.getUrl(favicon) : null,
      flags: tenant.flags,
    };
  },
});

// Set a tenant's brand logo or favicon (issue 12 / ADR 0022 §1). The dashboard
// (ticket 20) uploads the raster via the existing `resources.generateUploadUrl`
// flow, then hands the storage id here — the same two-step rail the Emblem uses.
//
// Reuses `assertEmblemImage` verbatim: raster only (PNG/JPEG/WebP), **SVG
// refused** (an XSS vector — tenant logos render on anonymous landing pages), and
// size-capped. Scope-gated by `isCallerAdmin(ctx, tenantSlug)` (issue 08): a sys
// admin may set any tenant's asset, a tenant admin only their own; a member is
// refused server-side, never merely hidden in the UI.
//
// Mint-new-never-overwrite (matches the Emblem): this records the *new* storage
// id and never deletes the previous blob, so any reference that already resolved
// to the old asset keeps resolving until GC. The palette is untouched — an asset
// swap spreads the existing `theme` and replaces one id.
export const setTenantAsset = mutation({
  args: {
    tenantSlug: v.string(),
    asset: v.union(v.literal("logo"), v.literal("favicon")),
    storageId: v.id("_storage"),
    contentType: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { tenantSlug, asset, storageId, contentType }) => {
    if (!(await isCallerAdmin(ctx, tenantSlug))) throw new Error("forbidden");
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", tenantSlug))
      .unique();
    if (!tenant) throw new Error("tenant not found");
    await assertEmblemImage(ctx, storageId, contentType);
    await ctx.db.patch(tenant._id, { theme: { ...tenant.theme, [asset]: storageId } });
    return null;
  },
});
