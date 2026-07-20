/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

// ticket 03 §1/§3: userPrefs is the durable cross-device account truth for the
// app-language, minted on first pick and synced into the cookie at login. It is
// NOT the render source (that's the cookie) — these functions only keep the
// account truth, which the client reads at login to seed a fresh device.

test("getMyLocale is null before any pick, and null for a guest", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");

  // Guest (no identity) → null, never throws.
  expect(await t.query(api.userPrefs.getMyLocale, {})).toBeNull();
  // Signed-in but never picked → null.
  expect(await asUser(t, alice).query(api.userPrefs.getMyLocale, {})).toBeNull();
});

test("setMyLocale mints one row on first pick, patches it thereafter", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const as = asUser(t, alice);

  await as.mutation(api.userPrefs.setMyLocale, { locale: "es" });
  expect(await as.query(api.userPrefs.getMyLocale, {})).toBe("es");

  // A second pick patches the same row (one row per user), not a second insert.
  await as.mutation(api.userPrefs.setMyLocale, { locale: "fr" });
  expect(await as.query(api.userPrefs.getMyLocale, {})).toBe("fr");

  const rows = await t.run((ctx) =>
    ctx.db
      .query("userPrefs")
      .withIndex("by_user", (q) => q.eq("userId", alice))
      .collect(),
  );
  expect(rows).toHaveLength(1);
});

test("setMyLocale rejects a guest — the cookie is the guest's only store", async () => {
  const t = convexTest(schema, modules);
  await expect(t.mutation(api.userPrefs.setMyLocale, { locale: "es" })).rejects.toThrow();
});

test("each user keeps their own locale", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");

  await asUser(t, alice).mutation(api.userPrefs.setMyLocale, { locale: "hi" });
  await asUser(t, bob).mutation(api.userPrefs.setMyLocale, { locale: "af" });

  expect(await asUser(t, alice).query(api.userPrefs.getMyLocale, {})).toBe("hi");
  expect(await asUser(t, bob).query(api.userPrefs.getMyLocale, {})).toBe("af");
});
