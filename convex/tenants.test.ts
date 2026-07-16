/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

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
