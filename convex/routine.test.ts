/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

beforeAll(() => {
  process.env.PUBLISH_SECRET = "test-secret";
});

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title: slug }));
}

test("claimWork hands out each locked-but-unclaimed topic once, then null", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const hindi = await seedTopic(t, alice, "hindi");
  const spanish = await seedTopic(t, alice, "spanish");
  const french = await seedTopic(t, alice, "french");
  await t.run(async (ctx) => {
    await ctx.db.insert("generation", { topicId: hindi, status: "generating", startedAt: 1 });
    await ctx.db.insert("generation", { topicId: spanish, status: "generating", startedAt: 2 });
    // Must be ignored: an already-claimed run, and a non-generating row.
    await ctx.db.insert("generation", { topicId: french, status: "generating", startedAt: 3, claimedAt: 99, runId: "old" });
  });
  const secret = "test-secret";

  const a = await t.mutation(api.routine.claimWork, { secret, runId: "r1" });
  const b = await t.mutation(api.routine.claimWork, { secret, runId: "r2" });
  const c = await t.mutation(api.routine.claimWork, { secret, runId: "r3" });

  expect([a?.topicSlug, b?.topicSlug].sort()).toEqual(["hindi", "spanish"]);
  expect(c).toBeNull(); // french was already claimed; nothing left
});

test("claimWork rejects a bad secret", async () => {
  const t = convexTest(schema, modules);
  await expect(t.mutation(api.routine.claimWork, { secret: "wrong", runId: "r1" })).rejects.toThrow();
});

test("materialiseTopic returns one owner's topic context and is owner-scoped", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["%PDF"], { type: "application/pdf" })));
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "L1", html: "<p>one</p>" });
    await ctx.db.insert("lessons", { topicId, key: "0000", seq: 0, title: "Old", html: "<p>x</p>", supersededBy: "0001" });
    await ctx.db.insert("references", { topicId, key: "grammar", title: "Grammar", html: "<p>ref</p>", contentHash: "h" });
    await ctx.db.insert("resources", { topicId, ownerId: alice, filename: "h.pdf", rawStorageId: storageId, contentHash: "c", status: "raw", kind: "file" });
  });
  const secret = "test-secret";

  const ctx = await t.query(api.routine.materialiseTopic, { secret, ownerEmail: "alice@example.com", topicSlug: "hindi" });
  expect(ctx?.lessons.map((l) => l.key)).toEqual(["0001"]); // superseded excluded
  expect(ctx?.references).toMatchObject([{ key: "grammar", html: "<p>ref</p>" }]);
  expect(ctx?.resources[0]).toMatchObject({ filename: "h.pdf", status: "raw" });
  expect(ctx?.resources[0]?.rawUrl).toBeTruthy();

  // Wrong owner → null.
  expect(await t.query(api.routine.materialiseTopic, { secret, ownerEmail: "nobody@example.com", topicSlug: "hindi" })).toBeNull();
});
