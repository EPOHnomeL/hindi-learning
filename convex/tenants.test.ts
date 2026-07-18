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
