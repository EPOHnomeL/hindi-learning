/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
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
  // claimWork hands back the owner too, so the run never needs a human-supplied
  // OWNER_EMAIL for the owner-scoped steps that follow.
  expect(a?.ownerEmail).toBe("alice@example.com");
  expect(b?.ownerEmail).toBe("alice@example.com");
  expect(c).toBeNull(); // french was already claimed; nothing left
});

test("claimWork returns ownerEmail null for an unowned topic", async () => {
  const t = convexTest(schema, modules);
  // A legacy/unowned Topic (no ownerId) — claimWork can't resolve an email, so it
  // returns null and the caller falls back to a manual OWNER_EMAIL.
  const orphan = await t.run((ctx) => ctx.db.insert("topics", { slug: "orphan", title: "Orphan" }));
  await t.run((ctx) => ctx.db.insert("generation", { topicId: orphan, status: "generating", startedAt: 1 }));

  const claimed = await t.mutation(api.routine.claimWork, { secret: "test-secret", runId: "r1" });
  expect(claimed).toMatchObject({ topicSlug: "orphan", ownerEmail: null });
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

test("materialiseTopic carries the mission/seed and learning records", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  // A seeded topic: a seed/"why" but no drafted mission yet.
  const seededId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: alice, slug: "greek", title: "Greek", status: "seeded", seed: "read the NT" }),
  );
  await t.run((ctx) => ctx.db.insert("learningRecords", { topicId: seededId, key: "0001-alpha", seq: 1, markdown: "# learned alpha" }));
  const secret = "test-secret";

  const seeded = await t.query(api.routine.materialiseTopic, { secret, ownerEmail: "alice@example.com", topicSlug: "greek" });
  expect(seeded?.topic).toMatchObject({ status: "seeded", mission: null, seed: "read the NT" });
  expect(seeded?.learningRecords).toEqual([{ key: "0001-alpha", seq: 1, markdown: "# learned alpha" }]);

  // An active topic with a drafted mission.
  await t.run((ctx) => ctx.db.patch(seededId, { status: "active", mission: "Read Koine fluently." }));
  const active = await t.query(api.routine.materialiseTopic, { secret, ownerEmail: "alice@example.com", topicSlug: "greek" });
  expect(active?.topic).toMatchObject({ status: "active", mission: "Read Koine fluently." });
});

test("publishLearningRecord is insert-once (append-only history)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  const secret = "test-secret";

  const first = await t.mutation(api.content.publishLearningRecord, { secret, topicId, key: "0001-x", seq: 1, markdown: "v1" });
  expect(first).toEqual({ status: "inserted" });
  // A second publish of the same key is a no-op — records are immutable history.
  const again = await t.mutation(api.content.publishLearningRecord, { secret, topicId, key: "0001-x", seq: 1, markdown: "v2" });
  expect(again).toEqual({ status: "exists" });

  const stored = await t.run((ctx) =>
    ctx.db.query("learningRecords").withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", "0001-x")).unique(),
  );
  expect(stored?.markdown).toBe("v1"); // unchanged
});

test("the bootstrap gate fires a seeded topic with no lessons; a plain empty topic does not", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await t.run((ctx) => ctx.db.insert("topics", { ownerId: alice, slug: "greek", title: "Greek", status: "seeded" }));
  await t.run((ctx) => ctx.db.insert("topics", { ownerId: alice, slug: "empty", title: "Empty" })); // no status, no lessons

  const seeded = await t.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "greek" });
  expect(seeded).toMatchObject({ acquired: true, frontierKey: "(seed)" });
  const plain = await t.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "empty" });
  expect(plain).toMatchObject({ acquired: false, reason: "no-frontier" });
});

test("the on-demand button is rate-limited per topic; the daily cron is not", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "L1", html: "<p>x</p>" });
    await ctx.db.insert("progress", { userId: alice, topicId, lessonKey: "0001", status: "completed" });
  });

  // First manual fire acquires (and stamps lastManualFireAt).
  expect(await t.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "hindi", manual: true })).toMatchObject({ acquired: true });
  // Simulate the run finishing — back to idle, lastManualFireAt retained.
  await t.run(async (ctx) => {
    const gen = await ctx.db.query("generation").withIndex("by_topic", (q) => q.eq("topicId", topicId)).unique();
    await ctx.db.patch(gen!._id, { status: "idle", startedAt: undefined, claimedAt: undefined, runId: undefined });
  });
  // A second manual fire within the cooldown is rate-limited...
  expect(await t.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "hindi", manual: true })).toMatchObject({ acquired: false, reason: "rate-limited" });
  // ...but the daily cron (manual=false) still fires.
  expect(await t.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "hindi", manual: false })).toMatchObject({ acquired: true });
});
