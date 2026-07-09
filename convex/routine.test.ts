/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test, vi } from "vitest";
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
// `userId|session` is the subject shape Convex Auth's getAuthUserId parses back.
function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
// A signed-in Admin: a user account plus their Admin row in the Allowlist.
async function seedAdmin(t: ReturnType<typeof convexTest>, email: string) {
  const userId = await seedUser(t, email);
  await t.mutation(internal.whitelist.seedEmail, { email, isAdmin: true });
  return userId;
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

test("finishGenerating is Admin-only and refuses a non-admin", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  // A signed-in owner who isn't the Admin can't fire the fire-and-pray loop.
  await expect(asUser(t, alice).action(api.routine.finishGenerating, { topicSlug: "hindi" })).rejects.toThrow();
  // The lock stays untouched — no run was started.
  const gen = await t.run((ctx) => ctx.db.query("generation").first());
  expect(gen).toBeNull();
});

test("finishGenerating: Admin starts a run and locks the topic generating", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  await seedTopic(t, admin, "hindi");

  const res = await asUser(t, admin).action(api.routine.finishGenerating, { topicSlug: "hindi" });
  expect(res).toEqual({ started: true });
  const gen = await t.run((ctx) => ctx.db.query("generation").first());
  expect(gen?.status).toBe("generating");
});

test("finishGenerating refuses a completed course and an in-flight run", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  // Completed courses never author again (ADR 0015) — fire-and-pray obeys that.
  const done = await t.run((ctx) => ctx.db.insert("topics", { ownerId: admin, slug: "done", title: "Done", status: "completed" }));
  expect(await asUser(t, admin).action(api.routine.finishGenerating, { topicSlug: "done" })).toEqual({
    started: false,
    reason: "completed",
  });
  expect(await t.run((ctx) => ctx.db.query("generation").withIndex("by_topic", (q) => q.eq("topicId", done)).first())).toBeNull();

  // A second fire while one is already in flight is refused (single-flight).
  await seedTopic(t, admin, "hindi");
  expect(await asUser(t, admin).action(api.routine.finishGenerating, { topicSlug: "hindi" })).toEqual({ started: true });
  expect(await asUser(t, admin).action(api.routine.finishGenerating, { topicSlug: "hindi" })).toEqual({
    started: false,
    reason: "already-generating",
  });
});

test("materialiseTopic returns one owner's topic context and is owner-scoped", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["%PDF"], { type: "application/pdf" })));
  await t.run(async (ctx) => {
    const refSid = await ctx.storage.store(new Blob(["<p>ref</p>"], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "L1" });
    await ctx.db.insert("lessons", { topicId, key: "0000", seq: 0, title: "Old", supersededBy: "0001" });
    await ctx.db.insert("references", { topicId, key: "grammar", title: "Grammar", htmlStorageId: refSid, contentHash: "h" });
    await ctx.db.insert("resources", { topicId, ownerId: alice, filename: "h.pdf", rawStorageId: storageId, contentHash: "c", status: "raw", kind: "file" });
  });
  const secret = "test-secret";

  const ctx = await t.query(api.routine.materialiseTopic, { secret, ownerEmail: "alice@example.com", topicSlug: "hindi" });
  expect(ctx?.lessons.map((l) => l.key)).toEqual(["0001"]); // superseded excluded
  // The blob-backed Reference body is exposed as a signed `htmlUrl` for the CLI.
  expect(ctx?.references).toMatchObject([{ key: "grammar", htmlUrl: expect.any(String) }]);
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

test("tryAcquireGeneration reports the topic's provider so the fire step can branch; absent reads as claude", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  // A seeded OpenRouter course (bootstrap gate passes) and a seeded default course
  // (no provider → claude).
  await t.run((ctx) => ctx.db.insert("topics", { ownerId: alice, slug: "glm", title: "GLM", status: "seeded", provider: "openrouter" }));
  await t.run((ctx) => ctx.db.insert("topics", { ownerId: alice, slug: "std", title: "Std", status: "seeded" }));

  expect(await t.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "glm" })).toMatchObject({ acquired: true, provider: "openrouter" });
  expect(await t.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "std" })).toMatchObject({ acquired: true, provider: "claude" });
});

test("the on-demand button is capped to one manual fire per user per day, across topics; the daily cron is not", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const hindi = await seedTopic(t, alice, "hindi");
  // A second course, also ready to fire (seeded → bootstrap gate passes), so the
  // only thing that can block a fire on it is the per-user daily cap.
  await t.run((ctx) => ctx.db.insert("topics", { ownerId: alice, slug: "spanish", title: "Spanish", status: "seeded" }));
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId: hindi, key: "0001", seq: 1, title: "L1" });
    await ctx.db.insert("progress", { userId: alice, topicId: hindi, lessonKey: "0001", status: "completed" });
  });
  const asAlice = asUser(t, alice);

  // First manual fire acquires (and stamps lastManualFireAt on the hindi lock row).
  expect(await asAlice.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "hindi", manual: true })).toMatchObject({ acquired: true });
  // A manual fire on a DIFFERENT course is now rate-limited too — the cap is per
  // user across all their courses, not per topic.
  expect(await asAlice.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "spanish", manual: true })).toMatchObject({ acquired: false, reason: "rate-limited" });
  // ...but the daily cron (manual=false) still fires that course.
  expect(await asAlice.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "spanish", manual: false })).toMatchObject({ acquired: true });
});

async function genStatus(t: ReturnType<typeof convexTest>, topicId: Id<"topics">) {
  return await t.run(async (ctx) =>
    (await ctx.db.query("generation").withIndex("by_topic", (q) => q.eq("topicId", topicId)).unique())?.status,
  );
}

test("firing an OpenRouter course schedules the authoring action (no POST) and the scheduled run resolves the lock", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const glm = await t.run((ctx) => ctx.db.insert("topics", { ownerId: alice, slug: "glm", title: "GLM", status: "seeded", provider: "openrouter" }));

  // Fake timers must be active BEFORE the fire so the `runAfter(0)` schedule is
  // set against the fake clock that `finishAllScheduledFunctions` then advances.
  vi.useFakeTimers();
  try {
    // ROUTINE_FIRE_URL is intentionally unset — the Claude POST path would fail;
    // the OpenRouter path must never reach it, so this fire succeeds by scheduling.
    const res = await asUser(t, alice).action(api.routine.requestSetup, { topicSlug: "glm" });
    expect(res).toMatchObject({ fired: true });
    expect(await genStatus(t, glm)).toBe("generating"); // lock held until the scheduled run reports

    // Run the scheduled authoring action end to end. This env has no
    // OPENROUTER_API_KEY (authoring is tested with a mocked client in
    // openrouter.test.ts), so the bootstrap reports `failed` — which still proves
    // the schedule → run → reportGeneration round-trip leaves the lock resolved,
    // never stuck `generating`.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally {
    vi.useRealTimers();
  }
  expect(await genStatus(t, glm)).toBe("failed");
});

test("firing a Claude course still takes the POST path (unchanged), never the scheduler", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const std = await t.run((ctx) => ctx.db.insert("topics", { ownerId: alice, slug: "std", title: "Std", status: "seeded" }));

  // No provider → Claude path: it attempts the routine POST. With ROUTINE_FIRE_URL
  // unset the fire can't land, surfacing as fire-error / a failed lock — proving it
  // took the POST branch, not the scheduler.
  const res = await asUser(t, alice).action(api.routine.requestSetup, { topicSlug: "std" });
  expect(res).toMatchObject({ fired: false, reason: "fire-error" });
  expect(await genStatus(t, std)).toBe("failed");
});

test("the Admin bypasses the on-demand cooldown", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "jvorster63@gmail.com");
  const topicId = await seedTopic(t, admin, "hindi");
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "L1" });
    await ctx.db.insert("progress", { userId: admin, topicId, lessonKey: "0001", status: "completed" });
  });

  // First manual fire acquires (and stamps lastManualFireAt).
  expect(await asUser(t, admin).mutation(internal.routine.tryAcquireGeneration, { topicSlug: "hindi", manual: true })).toMatchObject({ acquired: true });
  // Simulate the run finishing — back to idle, lastManualFireAt retained.
  await t.run(async (ctx) => {
    const gen = await ctx.db.query("generation").withIndex("by_topic", (q) => q.eq("topicId", topicId)).unique();
    await ctx.db.patch(gen!._id, { status: "idle", startedAt: undefined, claimedAt: undefined, runId: undefined });
  });
  // A second manual fire within the cooldown still acquires — the Admin is exempt,
  // where a non-Admin owner would be rate-limited (see the test above).
  expect(await asUser(t, admin).mutation(internal.routine.tryAcquireGeneration, { topicSlug: "hindi", manual: true })).toMatchObject({ acquired: true });
});

// ---- The `~N lessons` estimate (PRD: Estimated lesson count) ---------------

test("reportGeneration folds an estimate onto the topic; a later report without one never wipes it", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  // A run is in flight — the report also releases its lock, as in production.
  await t.run((ctx) => ctx.db.insert("generation", { topicId, status: "generating", startedAt: 1 }));
  const secret = "test-secret";

  // A published report carrying an estimate stores it on the Topic.
  await t.mutation(api.routine.reportGeneration, { secret, topicSlug: "hindi", outcome: "published", estimatedLessons: 8 });
  expect((await t.run((ctx) => ctx.db.get(topicId)))?.estimatedLessons).toBe(8);

  // A later `nothing`/`failed` report WITHOUT an estimate leaves it untouched —
  // the estimate lives on the Topic across runs, not on the generation lock.
  await t.mutation(api.routine.reportGeneration, { secret, topicSlug: "hindi", outcome: "nothing" });
  expect((await t.run((ctx) => ctx.db.get(topicId)))?.estimatedLessons).toBe(8);

  // A subsequent estimate overwrites it — the teacher revises freely each run.
  await t.mutation(api.routine.reportGeneration, { secret, topicSlug: "hindi", outcome: "published", estimatedLessons: 11 });
  expect((await t.run((ctx) => ctx.db.get(topicId)))?.estimatedLessons).toBe(11);
});

test("reportGeneration with an estimate still refuses a bad secret", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  await seedTopic(t, alice, "hindi");
  await expect(
    t.mutation(api.routine.reportGeneration, { secret: "wrong", topicSlug: "hindi", outcome: "published", estimatedLessons: 8 }),
  ).rejects.toThrow();
});

