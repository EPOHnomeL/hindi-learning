import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { assertAdmin } from "./adminSecret";
import { assertEmblemImage } from "./emblem";
import { isCallerAdmin } from "./whitelist";
import { tenantFlagsValidator, tenantThemeValidator } from "./schema";

// A tenant's skin: the 14-token palette contract, the house default palette, the
// read every frontend surface resolves it through (`getTheme`), and the writes
// that repaint it, set the motto, and mint the brand assets. Split out of
// `tenants.ts` by technical-foundation/18; provisioning, flags, donations and
// allocation are their own modules.

// The 14-token whitelabel palette contract (ticket 01 / 03). A tenant's
// `theme.light` must define all of these and nothing else; `theme.dark` may
// define a partial subset (the rest fall back to the default dark palette). The
// Convex validator keeps `light`/`dark` as loose records (hyphenated names like
// good-b can't be v.object keys), so the exact key set is enforced here in code.
// ponytail: the frontend src/design/tokens.ts is the single source of truth for
// this list; convex can't import from src/, so this is a hand mirror of it.
// Guarded, not deduplicated: src/design/tokens.test.ts imports both copies and
// fails when they disagree (a test can cross the runtime boundary the runtime
// cannot), so drift is loud rather than a silent first-paint colour flash.
export const TENANT_THEME_TOKENS = [
  "paper", "card", "ink", "soft", "line", "accent", "accent2", "gold",
  "hi", "danger", "good", "good-b", "bad", "bad-b",
] as const;

// The house default palette a freshly-created tenant starts from (issue 19). A
// new tenant needs a *complete* 14-token light palette so the SSR no-flash
// <style> and getTheme never break before the operator opens the theme editor
// (ticket 20) to paint the real brand. These are the light-mode `--color-*`
// values from src/styles/globals.css — Convex can't import from src/, so they're
// mirrored here (like TENANT_THEME_TOKENS, and held to globals.css by the same
// drift test in src/design/tokens.test.ts); the dark palette is left to fall back
// to the shared default dark (a tenant dark is opt-in, per 03).
export const DEFAULT_TENANT_THEME = {
  light: {
    paper: "#fbf7f0", card: "#fffdf9", ink: "#2b2622", soft: "#6b6258", line: "#e7ddd4",
    accent: "#9c5b34", accent2: "#3f6f5e", gold: "#b88a2e", hi: "#fbeecb",
    danger: "#b4442f", good: "#e7f3ec", "good-b": "#3f8f63", bad: "#fbe9e7", "bad-b": "#c0573f",
  },
};

export function assertThemeTokens(theme: { light: Record<string, string>; dark?: Record<string, string> }) {
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

// Fold a validated palette onto an existing tenant's stored theme: replace
// `light`, take `dark` only when supplied (a missing `dark` clears any stale one
// so it falls back to the default dark), and carry the brand assets across
// untouched (a repaint never disturbs the logo/favicon). Shared by both write
// paths — the secret-guarded `setTenantTheme` (operator scripts) and the
// identity-guarded `updateTenantTheme` (dashboard) — so the two never drift.
function themeWithAssetsPreserved(
  existing: Doc<"tenants">["theme"],
  theme: { light: Record<string, string>; dark?: Record<string, string> },
): Doc<"tenants">["theme"] {
  const next: Doc<"tenants">["theme"] = { light: theme.light };
  if (theme.dark) next.dark = theme.dark;
  if (existing.logo) next.logo = existing.logo;
  if (existing.favicon) next.favicon = existing.favicon;
  return next;
}

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

    await ctx.db.patch(tenant._id, { theme: themeWithAssetsPreserved(tenant.theme, theme) });
    return null;
  },
});

// The dashboard's palette write (ticket 20) — the identity-guarded twin of
// setTenantTheme. Same validation and asset-preserving repaint, but gated by
// `isCallerAdmin(ctx, tenantSlug)` (issue 08) instead of PUBLISH_SECRET, so a
// signed-in admin repaints from the panel without a secret: a sys admin any
// tenant, a tenant admin only their own, a member refused server-side (never
// merely hidden in the UI). Edit-is-live (03): the patch lands on `tenants.theme`
// and the tenant's live subdomain reflects it on the next SSR render (11) — no
// draft/published states. `tenantSlug` (not `slug`) matches setTenantAsset's arg
// shape, the other identity-guarded tenant write.
export const updateTenantTheme = mutation({
  args: {
    tenantSlug: v.string(),
    theme: tenantThemeValidator,
  },
  returns: v.null(),
  handler: async (ctx, { tenantSlug, theme }) => {
    if (!(await isCallerAdmin(ctx, tenantSlug))) throw new Error("forbidden");
    assertThemeTokens(theme);

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", tenantSlug))
      .unique();
    if (!tenant) throw new Error("tenant not found");

    await ctx.db.patch(tenant._id, { theme: themeWithAssetsPreserved(tenant.theme, theme) });
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
      motto: v.union(v.string(), v.null()),
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
      motto: tenant.motto ?? null,
      theme: dark ? { light, dark } : { light },
      logoUrl: logo ? await ctx.storage.getUrl(logo) : null,
      faviconUrl: favicon ? await ctx.storage.getUrl(favicon) : null,
      flags: tenant.flags,
    };
  },
});

// Set a tenant's motto — the subtitle shown under its logo on the sign-in and
// dashboard pages (whitelabel ADR draft §1), in place of the default site's
// fixed "Your learning workspace" tagline. Identity-guarded like
// `updateTenantTheme`: a sys admin sets any tenant's, a tenant admin only their
// own. An empty string clears it back to no motto (the header falls back to
// nothing rather than the default-site tagline, since a tenant page is never
// the default site).
export const updateTenantMotto = mutation({
  args: { tenantSlug: v.string(), motto: v.string() },
  returns: v.null(),
  handler: async (ctx, { tenantSlug, motto }) => {
    if (!(await isCallerAdmin(ctx, tenantSlug))) throw new Error("forbidden");
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", tenantSlug))
      .unique();
    if (!tenant) throw new Error("tenant not found");

    const trimmed = motto.trim();
    await ctx.db.patch(tenant._id, { motto: trimmed || undefined });
    return null;
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
