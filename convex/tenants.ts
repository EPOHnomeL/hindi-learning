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

// The house default palette a freshly-created tenant starts from (issue 19). A
// new tenant needs a *complete* 14-token light palette so the SSR no-flash
// <style> and getTheme never break before the operator opens the theme editor
// (ticket 20) to paint the real brand. These are the light-mode `--color-*`
// values from src/styles/globals.css — Convex can't import from src/, so they're
// mirrored here (like TENANT_THEME_TOKENS); the dark palette is left to fall back
// to the shared default dark (a tenant dark is opt-in, per 03). Flags default all
// on — the v1 no-regression posture (ticket 04).
const DEFAULT_TENANT_THEME = {
  light: {
    paper: "#fbf7f0", card: "#fffdf9", ink: "#2b2622", soft: "#6b6258", line: "#e7ddd4",
    accent: "#9c5b34", accent2: "#3f6f5e", gold: "#b88a2e", hi: "#fbeecb",
    danger: "#b4442f", good: "#e7f3ec", "good-b": "#3f8f63", bad: "#fbe9e7", "bad-b": "#c0573f",
  },
};
const DEFAULT_TENANT_FLAGS = {
  certificates: true, translations: true, publicLinks: true, qa: true, seeding: true,
};

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

// The dashboard sidebar's tenant list (issue 19): every tenant's slug + display
// name, sorted by display name. **Sys-admin only** — a tenant admin has no picker
// (they're locked to their own tenant), so this list is never theirs to see. The
// `tenants` table is bounded by the operator (one row per branded subdomain), so
// a full scan is the right read here.
export const listTenants = query({
  args: {},
  returns: v.array(v.object({ slug: v.string(), displayName: v.string() })),
  handler: async (ctx) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const rows = await ctx.db.query("tenants").collect();
    return rows
      .map((r) => ({ slug: r.slug, displayName: r.displayName }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
});

// Create a tenant from the dashboard's "+ New tenant" action (issue 19). **Sys
// admin only** — creating a tenant is a platform act, never a tenant admin's.
// The new row is seeded with the house default palette + all flags on so it's
// immediately resolvable (SSR/getTheme) and behaves like today; the operator then
// paints the real brand via the theme editor (ticket 20). Slug is normalised
// (trim + lower-case) and constrained to a subdomain-safe shape; a duplicate is
// refused (the slug is the tenant's identity on `by_slug`).
export const createTenant = mutation({
  args: { slug: v.string(), displayName: v.string() },
  returns: v.object({ slug: v.string() }),
  handler: async (ctx, { slug, displayName }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const normalisedSlug = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(normalisedSlug)) {
      throw new Error("Slug must be lower-case letters, numbers, and hyphens only.");
    }
    const name = displayName.trim();
    if (!name) throw new Error("A display name is required.");

    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", normalisedSlug))
      .unique();
    if (existing) throw new Error("A tenant with that slug already exists.");

    await ctx.db.insert("tenants", {
      slug: normalisedSlug,
      displayName: name,
      theme: DEFAULT_TENANT_THEME,
      flags: DEFAULT_TENANT_FLAGS,
    });
    return { slug: normalisedSlug };
  },
});

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

// Operator-script twin of setTenantAsset: same validation and mint-new semantics,
// but PUBLISH_SECRET-guarded (like seedTenant) instead of identity-guarded, so the
// branding scripts can set a tenant's logo/favicon without an authed session. The
// blob is uploaded via resources.generateProcessedUploadUrl (also secret-guarded).
export const seedTenantAsset = mutation({
  args: {
    secret: v.string(),
    tenantSlug: v.string(),
    asset: v.union(v.literal("logo"), v.literal("favicon")),
    storageId: v.id("_storage"),
    contentType: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { secret, tenantSlug, asset, storageId, contentType }) => {
    assertAdmin(secret);
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
