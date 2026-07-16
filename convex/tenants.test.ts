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
