/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { TENANT_THEME_TOKENS } from "./tenants";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

// `userId|session` is the subject shape Convex Auth's getAuthUserId parses back.
function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

// A signed-in admin: a user account plus their Allowlist admin row. A sys admin
// unless a slug is given, in which case a tenant admin scoped to that slug.
async function seedAdmin(t: ReturnType<typeof convexTest>, email: string, tenantSlug?: string) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email }));
  await t.mutation(internal.whitelist.seedEmail, { email, isAdmin: true, tenantSlug });
  return userId;
}

// Stash a raster (or, for the negative test, an SVG) blob and return its id.
async function storeImage(t: ReturnType<typeof convexTest>, type = "image/png") {
  return await t.run((ctx) => ctx.storage.store(new Blob(["x"], { type })));
}

beforeAll(() => {
  process.env.PUBLISH_SECRET = "test-secret";
});
const secret = "test-secret";

// A well-formed light palette: all 14 tokens from the design contract (issue 09
// / 03). CSS-friendly hyphenated names (good-b, bad-b) are quoted keys.
const LIGHT = {
  paper: "#fff", card: "#fff", ink: "#000", soft: "#111", line: "#222",
  accent: "#333", accent2: "#444", gold: "#555", hi: "#666",
  danger: "#777", good: "#888", "good-b": "#999", bad: "#aaa", "bad-b": "#bbb",
};
const THEME = { light: LIGHT };
const FLAGS = { certificates: true, translations: true, publicLinks: true, qa: true, seeding: true };

test("seedTenant inserts a tenant row with its theme and flags", async () => {
  const t = convexTest(schema, modules);
  const res = await t.mutation(api.tenants.seedTenant, {
    secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS,
  });
  expect(res.created).toBe(true);
  const rows = await t.run((ctx) => ctx.db.query("tenants").take(10));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
});

test("seedTenant is idempotent — a second call for the same slug skips (never duplicates or overwrites)", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  const res = await t.mutation(api.tenants.seedTenant, {
    secret, slug: "upf", displayName: "UPF renamed", theme: THEME, flags: FLAGS,
  });
  expect(res.created).toBe(false);
  const rows = await t.run((ctx) => ctx.db.query("tenants").take(10));
  expect(rows).toHaveLength(1);
  expect(rows[0]?.displayName).toBe("UPF"); // the original row is left untouched
});

test("seedTenant accepts an optional partial dark palette (subset of tokens)", async () => {
  const t = convexTest(schema, modules);
  const theme = { light: LIGHT, dark: { paper: "#111", ink: "#eee" } };
  const res = await t.mutation(api.tenants.seedTenant, {
    secret, slug: "yknot", displayName: "Y-Knot", theme, flags: FLAGS,
  });
  expect(res.created).toBe(true);
});

test("seedTenant rejects a theme missing a required light token", async () => {
  const t = convexTest(schema, modules);
  const light: Record<string, string> = { ...LIGHT };
  delete light["gold"];
  await expect(
    t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: { light }, flags: FLAGS }),
  ).rejects.toThrow(/missing/i);
});

test("seedTenant rejects a theme with an unknown token key", async () => {
  const t = convexTest(schema, modules);
  const theme = { light: { ...LIGHT, mystery: "#fff" } };
  await expect(
    t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme, flags: FLAGS }),
  ).rejects.toThrow(/unknown/i);
});

test("seedTenant refuses an incorrect secret", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.mutation(api.tenants.seedTenant, { secret: "wrong", slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS }),
  ).rejects.toThrow(/unauthorized/i);
});

// listTenants — the dashboard sidebar's tenant list (issue 19). Sys-admin only;
// returns each tenant's slug + display name, sorted by display name.

test("listTenants: a sys admin sees every tenant, sorted by display name", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await t.mutation(api.tenants.seedTenant, { secret, slug: "aw", displayName: "Almighty Warriors", theme: THEME, flags: FLAGS });

  const rows = await asUser(t, sys).query(api.tenants.listTenants, {});
  expect(rows).toEqual([
    { slug: "aw", displayName: "Almighty Warriors" },
    { slug: "upf", displayName: "UPF" },
  ]);
});

test("listTenants: a tenant admin is refused (sys-admin only)", async () => {
  const t = convexTest(schema, modules);
  const upfAdmin = await seedAdmin(t, "upfadmin@example.com", "upf");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await expect(asUser(t, upfAdmin).query(api.tenants.listTenants, {})).rejects.toThrow(/forbidden/i);
});

test("listTenants: a plain member is refused", async () => {
  const t = convexTest(schema, modules);
  const member = await t.run((ctx) => ctx.db.insert("users", { email: "member@example.com" }));
  await expect(asUser(t, member).query(api.tenants.listTenants, {})).rejects.toThrow(/forbidden/i);
});

// createTenant — the "+ New tenant" action (issue 19). Sys-admin only; seeds the
// row with the house default theme + all-on flags, ready for the theme editor (20).

test("createTenant: a sys admin creates a tenant seeded with a complete default theme + all flags on", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await asUser(t, sys).mutation(api.tenants.createTenant, { slug: "newco", displayName: "New Co" });

  const row = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "newco")).unique(),
  );
  expect(row?.displayName).toBe("New Co");
  // The seeded theme is a complete 14-token light palette (so getTheme/SSR never breaks).
  expect(Object.keys(row!.theme.light).sort()).toEqual([...TENANT_THEME_TOKENS].sort());
  expect(row?.flags).toEqual({ certificates: true, translations: true, publicLinks: true, qa: true, seeding: true });
});

test("createTenant: normalises the slug (trim + lower-case)", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await asUser(t, sys).mutation(api.tenants.createTenant, { slug: "  NewCo  ", displayName: "New Co" });
  const row = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "newco")).unique(),
  );
  expect(row).not.toBeNull();
});

test("createTenant: rejects a slug with illegal characters", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await expect(
    asUser(t, sys).mutation(api.tenants.createTenant, { slug: "bad slug!", displayName: "Bad" }),
  ).rejects.toThrow(/slug/i);
});

test("createTenant: rejects a duplicate slug", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await expect(
    asUser(t, sys).mutation(api.tenants.createTenant, { slug: "upf", displayName: "Dup" }),
  ).rejects.toThrow(/exists/i);
});

test("createTenant: a tenant admin is refused (sys-admin only)", async () => {
  const t = convexTest(schema, modules);
  const upfAdmin = await seedAdmin(t, "upfadmin@example.com", "upf");
  await expect(
    asUser(t, upfAdmin).mutation(api.tenants.createTenant, { slug: "newco", displayName: "New Co" }),
  ).rejects.toThrow(/forbidden/i);
});

// setTenantTheme — the palette overwrite path seedTenant refuses (create-only).
// Secret-guarded; repaints an existing tenant, preserving brand assets.

const LIGHT2 = {
  paper: "#f8f8f8", card: "#ffffff", ink: "#111827", soft: "#858fa2", line: "#ede7e0",
  accent: "#a48a66", accent2: "#49a2b7", gold: "#a48a66", hi: "#e7faff",
  danger: "#c0432f", good: "#3f7d54", "good-b": "#cfe6d6", bad: "#c0432f", "bad-b": "#f2d6cf",
};

test("setTenantTheme overwrites an existing tenant's palette", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.tenants.seedTenant, { secret, slug: "yknot", displayName: "Y-Knot", theme: THEME, flags: FLAGS });
  await t.mutation(api.tenants.setTenantTheme, { secret, slug: "yknot", theme: { light: LIGHT2 } });
  const row = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "yknot")).unique(),
  );
  expect(row?.theme.light).toEqual(LIGHT2);
});

test("setTenantTheme preserves logo/favicon and clears a stale dark when none is given", async () => {
  const t = convexTest(schema, modules);
  const logo = await storeImage(t);
  await t.run((ctx) =>
    ctx.db.insert("tenants", {
      slug: "yknot", displayName: "Y-Knot",
      theme: { light: LIGHT, dark: { paper: "#111" }, logo }, flags: FLAGS,
    }),
  );
  await t.mutation(api.tenants.setTenantTheme, { secret, slug: "yknot", theme: { light: LIGHT2 } });
  const row = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "yknot")).unique(),
  );
  expect(row?.theme.light).toEqual(LIGHT2);
  expect(row?.theme.logo).toBe(logo); // asset preserved
  expect(row?.theme.dark).toBeUndefined(); // stale dark cleared → falls back to default
});

test("setTenantTheme sets a partial dark when supplied", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.tenants.seedTenant, { secret, slug: "yknot", displayName: "Y-Knot", theme: THEME, flags: FLAGS });
  await t.mutation(api.tenants.setTenantTheme, {
    secret, slug: "yknot", theme: { light: LIGHT2, dark: { paper: "#111", ink: "#eee" } },
  });
  const row = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "yknot")).unique(),
  );
  expect(row?.theme.dark).toEqual({ paper: "#111", ink: "#eee" });
});

test("setTenantTheme rejects a theme missing a required light token", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.tenants.seedTenant, { secret, slug: "yknot", displayName: "Y-Knot", theme: THEME, flags: FLAGS });
  const light: Record<string, string> = { ...LIGHT2 };
  delete light["gold"];
  await expect(
    t.mutation(api.tenants.setTenantTheme, { secret, slug: "yknot", theme: { light } }),
  ).rejects.toThrow(/missing/i);
});

test("setTenantTheme refuses an incorrect secret", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.tenants.seedTenant, { secret, slug: "yknot", displayName: "Y-Knot", theme: THEME, flags: FLAGS });
  await expect(
    t.mutation(api.tenants.setTenantTheme, { secret: "wrong", slug: "yknot", theme: { light: LIGHT2 } }),
  ).rejects.toThrow(/unauthorized/i);
});

test("setTenantTheme rejects an unknown tenant slug", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.mutation(api.tenants.setTenantTheme, { secret, slug: "ghost", theme: { light: LIGHT2 } }),
  ).rejects.toThrow(/not found/i);
});

// updateTenantTheme — the identity-guarded dashboard twin of setTenantTheme
// (ticket 20). Same validation + asset-preserving semantics, but gated by
// `isCallerAdmin(ctx, tenantSlug)` so a signed-in admin repaints from the panel
// (no PUBLISH_SECRET). A sys admin may repaint any tenant; a tenant admin only
// their own; a member is refused server-side.

test("updateTenantTheme: a sys admin repaints any tenant's palette", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "yknot", displayName: "Y-Knot", theme: THEME, flags: FLAGS });
  await asUser(t, sys).mutation(api.tenants.updateTenantTheme, { tenantSlug: "yknot", theme: { light: LIGHT2 } });
  const row = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "yknot")).unique(),
  );
  expect(row?.theme.light).toEqual(LIGHT2);
});

test("updateTenantTheme: a tenant admin repaints their own tenant but not another's", async () => {
  const t = convexTest(schema, modules);
  const upfAdmin = await seedAdmin(t, "upfadmin@example.com", "upf");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await t.mutation(api.tenants.seedTenant, { secret, slug: "ywampotch", displayName: "YW", theme: THEME, flags: FLAGS });

  // Own tenant → allowed.
  await asUser(t, upfAdmin).mutation(api.tenants.updateTenantTheme, { tenantSlug: "upf", theme: { light: LIGHT2 } });
  const own = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "upf")).unique(),
  );
  expect(own?.theme.light).toEqual(LIGHT2);

  // Another tenant → refused (acceptance: a tenant admin can't edit another's theme).
  await expect(
    asUser(t, upfAdmin).mutation(api.tenants.updateTenantTheme, { tenantSlug: "ywampotch", theme: { light: LIGHT2 } }),
  ).rejects.toThrow(/forbidden/i);
});

test("updateTenantTheme: a plain member is refused", async () => {
  const t = convexTest(schema, modules);
  const member = await t.run((ctx) => ctx.db.insert("users", { email: "member@example.com" }));
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await expect(
    asUser(t, member).mutation(api.tenants.updateTenantTheme, { tenantSlug: "upf", theme: { light: LIGHT2 } }),
  ).rejects.toThrow(/forbidden/i);
});

test("updateTenantTheme: preserves logo/favicon, clears a stale dark, sets a partial dark", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  const logo = await storeImage(t);
  await t.run((ctx) =>
    ctx.db.insert("tenants", {
      slug: "yknot", displayName: "Y-Knot",
      theme: { light: LIGHT, dark: { paper: "#111" }, logo }, flags: FLAGS,
    }),
  );

  // No dark given → stale dark cleared, asset preserved.
  await asUser(t, sys).mutation(api.tenants.updateTenantTheme, { tenantSlug: "yknot", theme: { light: LIGHT2 } });
  let row = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "yknot")).unique(),
  );
  expect(row?.theme.light).toEqual(LIGHT2);
  expect(row?.theme.logo).toBe(logo);
  expect(row?.theme.dark).toBeUndefined();

  // A supplied partial dark is stored.
  await asUser(t, sys).mutation(api.tenants.updateTenantTheme, {
    tenantSlug: "yknot", theme: { light: LIGHT2, dark: { paper: "#111", ink: "#eee" } },
  });
  row = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "yknot")).unique(),
  );
  expect(row?.theme.dark).toEqual({ paper: "#111", ink: "#eee" });
  expect(row?.theme.logo).toBe(logo); // asset still preserved
});

test("updateTenantTheme: rejects a theme missing a required light token", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "yknot", displayName: "Y-Knot", theme: THEME, flags: FLAGS });
  const light: Record<string, string> = { ...LIGHT2 };
  delete light["gold"];
  await expect(
    asUser(t, sys).mutation(api.tenants.updateTenantTheme, { tenantSlug: "yknot", theme: { light } }),
  ).rejects.toThrow(/missing/i);
});

test("updateTenantTheme: rejects an unknown tenant slug", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await expect(
    asUser(t, sys).mutation(api.tenants.updateTenantTheme, { tenantSlug: "ghost", theme: { light: LIGHT2 } }),
  ).rejects.toThrow(/not found/i);
});

// getTheme — the frontend's read seam (issue 11): the SSR no-flash palette, the
// server favicon, and the client tenant context all resolve one tenant row by slug
// through this single indexed read.

test("getTheme returns the resolved frontend view for a seeded slug", async () => {
  const t = convexTest(schema, modules);
  const dark = { paper: "#111", ink: "#eee" };
  await t.mutation(api.tenants.seedTenant, {
    secret, slug: "yknot", displayName: "Y-Knot", theme: { light: LIGHT, dark }, flags: FLAGS,
  });

  const view = await t.query(api.tenants.getTheme, { slug: "yknot" });
  expect(view).toMatchObject({
    displayName: "Y-Knot",
    theme: { light: LIGHT, dark },
    flags: FLAGS,
    // No assets were seeded — the client falls back to the wordmark / shared favicon.
    logoUrl: null,
    faviconUrl: null,
  });
});

test("getTheme returns null for an unknown slug (default site / not a tenant)", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  expect(await t.query(api.tenants.getTheme, { slug: "nope" })).toBeNull();
});

test("getTheme resolves logo and favicon storage ids to urls", async () => {
  const t = convexTest(schema, modules);
  const logo = await t.run((ctx) => ctx.storage.store(new Blob(["logo"], { type: "image/png" })));
  const favicon = await t.run((ctx) => ctx.storage.store(new Blob(["fav"], { type: "image/png" })));
  await t.run((ctx) =>
    ctx.db.insert("tenants", { slug: "upf", displayName: "UPF", theme: { light: LIGHT, logo, favicon }, flags: FLAGS }),
  );

  const view = await t.query(api.tenants.getTheme, { slug: "upf" });
  expect(typeof view?.logoUrl).toBe("string");
  expect(typeof view?.faviconUrl).toBe("string");
  // The palette-only theme is returned without the storage ids (surfaced as urls).
  expect(view?.theme).not.toHaveProperty("logo");
  expect(view?.theme).not.toHaveProperty("favicon");
});

// setTenantAsset — the brand logo/favicon upload record (issue 12). The client
// uploads a raster via resources.generateUploadUrl, then hands the storage id
// here; this validates it (reusing the emblem rail) and swaps it onto the tenant.

test("setTenantAsset: a sys admin sets a tenant logo and favicon", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });

  const logo = await storeImage(t);
  const favicon = await storeImage(t, "image/webp");
  await asUser(t, sys).mutation(api.tenants.setTenantAsset, {
    tenantSlug: "upf", asset: "logo", storageId: logo, contentType: "image/png",
  });
  await asUser(t, sys).mutation(api.tenants.setTenantAsset, {
    tenantSlug: "upf", asset: "favicon", storageId: favicon, contentType: "image/webp",
  });

  const row = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "upf")).unique(),
  );
  expect(row?.theme.logo).toBe(logo);
  expect(row?.theme.favicon).toBe(favicon);
  // The palette is untouched by an asset swap.
  expect(row?.theme.light).toEqual(LIGHT);
});

test("setTenantAsset: an SVG upload is refused (XSS on the anonymous page)", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });

  const svg = await storeImage(t, "image/svg+xml");
  await expect(
    asUser(t, sys).mutation(api.tenants.setTenantAsset, {
      tenantSlug: "upf", asset: "logo", storageId: svg, contentType: "image/svg+xml",
    }),
  ).rejects.toThrow(/PNG|JPEG|WebP/i);
});

test("setTenantAsset: a tenant admin can set their own tenant but not another's", async () => {
  const t = convexTest(schema, modules);
  const upfAdmin = await seedAdmin(t, "upfadmin@example.com", "upf");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await t.mutation(api.tenants.seedTenant, { secret, slug: "ywampotch", displayName: "YW", theme: THEME, flags: FLAGS });

  const logo = await storeImage(t);
  // Own tenant → allowed.
  await asUser(t, upfAdmin).mutation(api.tenants.setTenantAsset, {
    tenantSlug: "upf", asset: "logo", storageId: logo, contentType: "image/png",
  });
  // Another tenant → refused.
  await expect(
    asUser(t, upfAdmin).mutation(api.tenants.setTenantAsset, {
      tenantSlug: "ywampotch", asset: "logo", storageId: logo, contentType: "image/png",
    }),
  ).rejects.toThrow(/forbidden/i);
});

test("setTenantAsset: a plain member is refused", async () => {
  const t = convexTest(schema, modules);
  const member = await t.run((ctx) => ctx.db.insert("users", { email: "member@example.com" }));
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  const logo = await storeImage(t);
  await expect(
    asUser(t, member).mutation(api.tenants.setTenantAsset, {
      tenantSlug: "upf", asset: "logo", storageId: logo, contentType: "image/png",
    }),
  ).rejects.toThrow(/forbidden/i);
});

test("setTenantAsset: mint-new — a new logo swaps the id and leaves the old blob resolvable", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });

  const first = await storeImage(t);
  await asUser(t, sys).mutation(api.tenants.setTenantAsset, {
    tenantSlug: "upf", asset: "logo", storageId: first, contentType: "image/png",
  });
  const second = await storeImage(t);
  await asUser(t, sys).mutation(api.tenants.setTenantAsset, {
    tenantSlug: "upf", asset: "logo", storageId: second, contentType: "image/png",
  });

  const row = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "upf")).unique(),
  );
  expect(row?.theme.logo).toBe(second);
  expect(row?.theme.logo).not.toBe(first);
  // The old blob was never deleted — a previously-minted reference still resolves.
  const oldUrl = await t.run((ctx) => ctx.storage.getUrl(first));
  expect(oldUrl).not.toBeNull();
});

test("setTenantAsset: an unknown tenant slug is rejected", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  const logo = await storeImage(t);
  await expect(
    asUser(t, sys).mutation(api.tenants.setTenantAsset, {
      tenantSlug: "ghost", asset: "logo", storageId: logo, contentType: "image/png",
    }),
  ).rejects.toThrow(/not found/i);
});

// seedTenantAsset — the secret-guarded operator twin used by the branding scripts.

test("seedTenantAsset: a correct secret sets the logo without an auth identity", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.tenants.seedTenant, { secret, slug: "yknot", displayName: "Y-Knot", theme: THEME, flags: FLAGS });
  const logo = await storeImage(t, "image/webp");
  await t.mutation(api.tenants.seedTenantAsset, {
    secret, tenantSlug: "yknot", asset: "logo", storageId: logo, contentType: "image/webp",
  });
  const row = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "yknot")).unique(),
  );
  expect(row?.theme.logo).toBe(logo);
  expect(row?.theme.light).toEqual(LIGHT); // palette untouched
});

test("seedTenantAsset: refuses an incorrect secret", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.tenants.seedTenant, { secret, slug: "yknot", displayName: "Y-Knot", theme: THEME, flags: FLAGS });
  const logo = await storeImage(t);
  await expect(
    t.mutation(api.tenants.seedTenantAsset, {
      secret: "wrong", tenantSlug: "yknot", asset: "logo", storageId: logo, contentType: "image/png",
    }),
  ).rejects.toThrow(/unauthorized/i);
});

test("seedTenantAsset: refuses an SVG (XSS on the anonymous page)", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.tenants.seedTenant, { secret, slug: "yknot", displayName: "Y-Knot", theme: THEME, flags: FLAGS });
  const svg = await storeImage(t, "image/svg+xml");
  await expect(
    t.mutation(api.tenants.seedTenantAsset, {
      secret, tenantSlug: "yknot", asset: "logo", storageId: svg, contentType: "image/svg+xml",
    }),
  ).rejects.toThrow(/PNG|JPEG|WebP/i);
});

// ---- Course assignment (issue 22) ----------------------------------------
// A tenant's Courses section: which `topics` carry this tenant's `tenantSlug`,
// which are still assignable (default-only), and the assign/unassign writes.

async function seedTopic(t: ReturnType<typeof convexTest>, slug: string, title: string, tenantSlug?: string) {
  return await t.run((ctx) => ctx.db.insert("topics", { slug, title, ...(tenantSlug ? { tenantSlug } : {}) }));
}

test("courseAssignment: splits a tenant's own courses from the assignable (default-only) pool", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await seedTopic(t, "greek", "Greek", "upf");
  await seedTopic(t, "hebrew", "Hebrew"); // default-only → assignable
  await seedTopic(t, "latin", "Latin", "other"); // another tenant's → neither list

  const view = await asUser(t, sys).query(api.tenants.courseAssignment, { tenantSlug: "upf" });
  expect(view.assigned.map((c) => c.title)).toEqual(["Greek"]);
  expect(view.available.map((c) => c.title)).toEqual(["Hebrew"]);
});

test("assignCourse sets the tenantSlug; unassignCourse clears it back to unset", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  const topicId = await seedTopic(t, "greek", "Greek");

  await asUser(t, sys).mutation(api.tenants.assignCourse, { tenantSlug: "upf", topicId });
  expect(await t.run((ctx) => ctx.db.get(topicId)).then((r) => r?.tenantSlug)).toBe("upf");

  await asUser(t, sys).mutation(api.tenants.unassignCourse, { tenantSlug: "upf", topicId });
  expect(await t.run((ctx) => ctx.db.get(topicId)).then((r) => r?.tenantSlug)).toBeUndefined();
});

test("assignCourse refuses stealing a course already owned by another tenant", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  const topicId = await seedTopic(t, "greek", "Greek", "other");
  await expect(
    asUser(t, sys).mutation(api.tenants.assignCourse, { tenantSlug: "upf", topicId }),
  ).rejects.toThrow(/another tenant/i);
});

test("assignCourse: a tenant admin may assign to their own tenant but not another's; a member is refused", async () => {
  const t = convexTest(schema, modules);
  const upfAdmin = await seedAdmin(t, "upfadmin@example.com", "upf");
  const member = await t.run((ctx) => ctx.db.insert("users", { email: "member@example.com" }));
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await t.mutation(api.tenants.seedTenant, { secret, slug: "aw", displayName: "AW", theme: THEME, flags: FLAGS });
  const own = await seedTopic(t, "greek", "Greek");
  const other = await seedTopic(t, "hebrew", "Hebrew");

  await asUser(t, upfAdmin).mutation(api.tenants.assignCourse, { tenantSlug: "upf", topicId: own });
  await expect(
    asUser(t, upfAdmin).mutation(api.tenants.assignCourse, { tenantSlug: "aw", topicId: other }),
  ).rejects.toThrow(/forbidden/i);
  await expect(
    asUser(t, member).mutation(api.tenants.assignCourse, { tenantSlug: "upf", topicId: other }),
  ).rejects.toThrow(/forbidden/i);
});

// ---- Member assignment (issue 22) ----------------------------------------
// A tenant's Members section: which `whitelist` rows carry this tenant's slug,
// which unassigned non-admin emails are assignable, and the assign/unassign writes.

test("memberAssignment: lists a tenant's own members and the assignable (unassigned, non-admin) pool", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com"); // sys admin — never assignable
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await t.mutation(internal.whitelist.seedEmail, { email: "amy@example.com", tenantSlug: "upf" }); // assigned member
  await t.mutation(internal.whitelist.seedEmail, { email: "ben@example.com" }); // free → assignable
  await t.mutation(internal.whitelist.seedEmail, { email: "cara@example.com", tenantSlug: "other" }); // another tenant's
  void sys;

  const view = await asUser(t, sys).query(api.tenants.memberAssignment, { tenantSlug: "upf" });
  expect(view.assigned.map((m) => m.email)).toEqual(["amy@example.com"]);
  expect(view.available.map((m) => m.email)).toEqual(["ben@example.com"]);
});

test("assignMember sets the whitelist row's tenantSlug; unassignMember clears it", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await t.mutation(internal.whitelist.seedEmail, { email: "ben@example.com" });

  await asUser(t, sys).mutation(api.tenants.assignMember, { tenantSlug: "upf", email: "ben@example.com" });
  const after = await t.run((ctx) =>
    ctx.db.query("whitelist").withIndex("by_email", (q) => q.eq("email", "ben@example.com")).unique(),
  );
  expect(after?.tenantSlug).toBe("upf");

  await asUser(t, sys).mutation(api.tenants.unassignMember, { tenantSlug: "upf", email: "ben@example.com" });
  const cleared = await t.run((ctx) =>
    ctx.db.query("whitelist").withIndex("by_email", (q) => q.eq("email", "ben@example.com")).unique(),
  );
  expect(cleared?.tenantSlug).toBeUndefined();
});

test("assignMember refuses to scope a sys admin, and refuses stealing another tenant's member", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await t.mutation(internal.whitelist.seedEmail, { email: "cara@example.com", tenantSlug: "other" });

  await expect(
    asUser(t, sys).mutation(api.tenants.assignMember, { tenantSlug: "upf", email: "sys@example.com" }),
  ).rejects.toThrow(/sys admin/i);
  await expect(
    asUser(t, sys).mutation(api.tenants.assignMember, { tenantSlug: "upf", email: "cara@example.com" }),
  ).rejects.toThrow(/another tenant/i);
});

test("assignMember refuses an email that isn't on the Allowlist", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await expect(
    asUser(t, sys).mutation(api.tenants.assignMember, { tenantSlug: "upf", email: "ghost@example.com" }),
  ).rejects.toThrow(/allowlist/i);
});

// setTenantFlags — the dashboard flag toggles (issue 21). A patch-style write
// over `tenants.flags`, scope-gated by isCallerAdmin(ctx, tenantSlug). Enforced
// server-side by assertTenantFlag (issue 17); this is the operator's toggle.

test("setTenantFlags patches only the given flags, leaving the rest intact", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await asUser(t, sys).mutation(api.tenants.setTenantFlags, { tenantSlug: "upf", flags: { qa: false } });
  const row = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "upf")).unique(),
  );
  expect(row?.flags).toEqual({ ...FLAGS, qa: false });
});

test("setTenantFlags can toggle a flag back on", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, {
    secret, slug: "upf", displayName: "UPF", theme: THEME, flags: { ...FLAGS, publicLinks: false },
  });
  await asUser(t, sys).mutation(api.tenants.setTenantFlags, { tenantSlug: "upf", flags: { publicLinks: true } });
  const row = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "upf")).unique(),
  );
  expect(row?.flags.publicLinks).toBe(true);
});

test("setTenantFlags: a tenant admin may toggle only their own tenant's flags", async () => {
  const t = convexTest(schema, modules);
  const upfAdmin = await seedAdmin(t, "upfadmin@example.com", "upf");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await t.mutation(api.tenants.seedTenant, { secret, slug: "aw", displayName: "AW", theme: THEME, flags: FLAGS });
  // Own tenant → allowed.
  await asUser(t, upfAdmin).mutation(api.tenants.setTenantFlags, { tenantSlug: "upf", flags: { seeding: false } });
  const upf = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "upf")).unique(),
  );
  expect(upf?.flags.seeding).toBe(false);
  // Another tenant → refused.
  await expect(
    asUser(t, upfAdmin).mutation(api.tenants.setTenantFlags, { tenantSlug: "aw", flags: { seeding: false } }),
  ).rejects.toThrow(/forbidden/i);
});

test("setTenantFlags: a plain member is refused", async () => {
  const t = convexTest(schema, modules);
  const member = await t.run((ctx) => ctx.db.insert("users", { email: "member@example.com" }));
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await expect(
    asUser(t, member).mutation(api.tenants.setTenantFlags, { tenantSlug: "upf", flags: { qa: false } }),
  ).rejects.toThrow(/forbidden/i);
});

test("setTenantFlags rejects an unknown tenant slug", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await expect(
    asUser(t, sys).mutation(api.tenants.setTenantFlags, { tenantSlug: "ghost", flags: { qa: false } }),
  ).rejects.toThrow(/not found/i);
});

test("unassignMember refuses a tenant admin (clearing the slug would promote them to sys admin)", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await t.mutation(internal.whitelist.seedEmail, { email: "upfadmin@example.com", isAdmin: true, tenantSlug: "upf" });
  await expect(
    asUser(t, sys).mutation(api.tenants.unassignMember, { tenantSlug: "upf", email: "upfadmin@example.com" }),
  ).rejects.toThrow(/tenant admin/i);
});

test("assignMember: a tenant admin may act on their own tenant but not another's; a member is refused", async () => {
  const t = convexTest(schema, modules);
  const upfAdmin = await seedAdmin(t, "upfadmin@example.com", "upf");
  const plain = await t.run((ctx) => ctx.db.insert("users", { email: "plain@example.com" }));
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await t.mutation(api.tenants.seedTenant, { secret, slug: "aw", displayName: "AW", theme: THEME, flags: FLAGS });
  await t.mutation(internal.whitelist.seedEmail, { email: "ben@example.com" });

  await asUser(t, upfAdmin).mutation(api.tenants.assignMember, { tenantSlug: "upf", email: "ben@example.com" });
  await asUser(t, upfAdmin).mutation(api.tenants.unassignMember, { tenantSlug: "upf", email: "ben@example.com" });
  await expect(
    asUser(t, upfAdmin).mutation(api.tenants.assignMember, { tenantSlug: "aw", email: "ben@example.com" }),
  ).rejects.toThrow(/forbidden/i);
  await expect(
    asUser(t, plain).mutation(api.tenants.assignMember, { tenantSlug: "upf", email: "ben@example.com" }),
  ).rejects.toThrow(/forbidden/i);
});

// ---- Tenant removal guard (issue 22 / mirrors ADR 0011's refuse-to-remove) --

test("removeTenant is blocked while a course still references the tenant", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await seedTopic(t, "greek", "Greek", "upf");
  await expect(
    asUser(t, sys).mutation(api.tenants.removeTenant, { tenantSlug: "upf" }),
  ).rejects.toThrow(/still (has|references)|assigned/i);
});

test("removeTenant is blocked while a member (whitelist) references the tenant", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await t.mutation(internal.whitelist.seedEmail, { email: "amy@example.com", tenantSlug: "upf" });
  await expect(
    asUser(t, sys).mutation(api.tenants.removeTenant, { tenantSlug: "upf" }),
  ).rejects.toThrow(/still (has|references)|assigned/i);
});

test("removeTenant is blocked while a user account references the tenant", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await t.run((ctx) => ctx.db.insert("users", { email: "learner@example.com", tenantSlug: "upf" }));
  await expect(
    asUser(t, sys).mutation(api.tenants.removeTenant, { tenantSlug: "upf" }),
  ).rejects.toThrow(/still (has|references)|assigned/i);
});

test("removeTenant deletes an empty tenant's row", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await asUser(t, sys).mutation(api.tenants.removeTenant, { tenantSlug: "upf" });
  const row = await t.run((ctx) =>
    ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", "upf")).unique(),
  );
  expect(row).toBeNull();
});

test("tenantReferenceCounts reports courses / members / users referencing the slug", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await seedTopic(t, "greek", "Greek", "upf");
  await seedTopic(t, "hebrew", "Hebrew", "upf");
  await t.mutation(internal.whitelist.seedEmail, { email: "amy@example.com", tenantSlug: "upf" });
  await t.run((ctx) => ctx.db.insert("users", { email: "learner@example.com", tenantSlug: "upf" }));

  expect(await asUser(t, sys).query(api.tenants.tenantReferenceCounts, { tenantSlug: "upf" })).toEqual({
    courses: 2,
    members: 1,
    users: 1,
  });
});

test("removeTenant: a plain member is refused", async () => {
  const t = convexTest(schema, modules);
  const member = await t.run((ctx) => ctx.db.insert("users", { email: "member@example.com" }));
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await expect(
    asUser(t, member).mutation(api.tenants.removeTenant, { tenantSlug: "upf" }),
  ).rejects.toThrow(/forbidden/i);
});

// setTenantAdmin — grant/revoke tenant admin (issue 24). Sys-admin only mints
// tenant admins; a tenant admin can't. Promote = isAdmin + tenantSlug (assigning
// in the same step if unscoped); revoke = clear isAdmin, keep tenantSlug (demote
// to a plain member of the same tenant).

async function seedMember(t: ReturnType<typeof convexTest>, email: string, tenantSlug?: string) {
  await t.mutation(internal.whitelist.seedEmail, { email, tenantSlug });
}
async function adminScopeOf(t: ReturnType<typeof convexTest>, email: string) {
  const row = await t.run((ctx) =>
    ctx.db.query("whitelist").withIndex("by_email", (q) => q.eq("email", email)).unique(),
  );
  return { isAdmin: row?.isAdmin ?? false, tenantSlug: row?.tenantSlug };
}

test("setTenantAdmin: a sys admin promotes an assigned member, then revokes back to member", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await seedMember(t, "m@example.com", "upf");

  await asUser(t, sys).mutation(api.tenants.setTenantAdmin, { tenantSlug: "upf", email: "m@example.com", makeAdmin: true });
  expect(await adminScopeOf(t, "m@example.com")).toEqual({ isAdmin: true, tenantSlug: "upf" });

  await asUser(t, sys).mutation(api.tenants.setTenantAdmin, { tenantSlug: "upf", email: "m@example.com", makeAdmin: false });
  expect(await adminScopeOf(t, "m@example.com")).toEqual({ isAdmin: false, tenantSlug: "upf" });
});

test("setTenantAdmin: promoting an unassigned admitted email assigns + promotes in one step", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await seedMember(t, "free@example.com"); // admitted, no tenant

  await asUser(t, sys).mutation(api.tenants.setTenantAdmin, { tenantSlug: "upf", email: "free@example.com", makeAdmin: true });
  expect(await adminScopeOf(t, "free@example.com")).toEqual({ isAdmin: true, tenantSlug: "upf" });
});

test("setTenantAdmin: a tenant admin is refused (sys-admin only mints admins)", async () => {
  const t = convexTest(schema, modules);
  const upfAdmin = await seedAdmin(t, "upfadmin@example.com", "upf");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await seedMember(t, "m@example.com", "upf");
  await expect(
    asUser(t, upfAdmin).mutation(api.tenants.setTenantAdmin, { tenantSlug: "upf", email: "m@example.com", makeAdmin: true }),
  ).rejects.toThrow(/forbidden/i);
});

test("setTenantAdmin: refuses an email that isn't on the Allowlist", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await expect(
    asUser(t, sys).mutation(api.tenants.setTenantAdmin, { tenantSlug: "upf", email: "ghost@example.com", makeAdmin: true }),
  ).rejects.toThrow(/Allowlist/i);
});

test("setTenantAdmin: refuses promoting a sys admin", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await seedAdmin(t, "sys2@example.com"); // another sys admin
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await expect(
    asUser(t, sys).mutation(api.tenants.setTenantAdmin, { tenantSlug: "upf", email: "sys2@example.com", makeAdmin: true }),
  ).rejects.toThrow(/sys admin/i);
});

test("setTenantAdmin: refuses promoting a member of another tenant", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await t.mutation(api.tenants.seedTenant, { secret, slug: "aw", displayName: "AW", theme: THEME, flags: FLAGS });
  await seedMember(t, "m@example.com", "aw");
  await expect(
    asUser(t, sys).mutation(api.tenants.setTenantAdmin, { tenantSlug: "upf", email: "m@example.com", makeAdmin: true }),
  ).rejects.toThrow(/another tenant/i);
});

test("setTenantAdmin: revoking someone who isn't an admin of this tenant throws", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedAdmin(t, "sys@example.com");
  await t.mutation(api.tenants.seedTenant, { secret, slug: "upf", displayName: "UPF", theme: THEME, flags: FLAGS });
  await seedMember(t, "m@example.com", "upf");
  await expect(
    asUser(t, sys).mutation(api.tenants.setTenantAdmin, { tenantSlug: "upf", email: "m@example.com", makeAdmin: false }),
  ).rejects.toThrow(/isn't an admin/i);
});
