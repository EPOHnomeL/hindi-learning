/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// Regeneration: the owner gives a brief on one published Lesson and the teacher
// authors a REPLACEMENT that supersedes it (ADR 0003, immutable Lessons). It
// rides the routine's existing gate, lock, materialise and report seams, so what
// is worth testing is exactly the places it differs from an ordinary run: the
// gate it skips, the brief it stores, the revision key it mints, and the fact
// that the brief is spent by the run that reads it.

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

test("tryAcquireRegeneration arms the lock with the brief, past the frontier gate", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001-intro", seq: 1, title: "Intro" });
    await ctx.db.insert("lessons", { topicId, key: "0002-next", seq: 2, title: "Next" });
  });

  // Lesson 1 is not the Frontier, and nothing is completed. Either would refuse
  // an ordinary fire; a regeneration replaces a step rather than adding one, so
  // neither applies to it.
  const res = await asUser(t, alice).mutation(internal.routine.tryAcquireRegeneration, {
    topicSlug: "hindi",
    lessonKey: "0001-intro",
    brief: "too hard, more examples",
  });
  expect(res).toMatchObject({ acquired: true, topicSlug: "hindi", authoringProvider: "claude" });

  const gen = await t.run((ctx) => ctx.db.query("generation").unique());
  expect(gen).toMatchObject({
    status: "generating",
    frontierKey: "0001-intro",
    regenerate: { lessonKey: "0001-intro", brief: "too hard, more examples" },
  });
  // It counts as the caller's on-demand fire for the day, exactly as the
  // "generate next lesson" button does: it spends the same one model run.
  expect(gen?.lastManualFireAt).toBeGreaterThan(0);
});

test("tryAcquireRegeneration refuses an unknown or already-retired lesson", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", {
      topicId,
      key: "0001-intro",
      seq: 1,
      title: "Intro",
      supersededBy: "0001-intro-r2",
    });
    await ctx.db.insert("lessons", { topicId, key: "0001-intro-r2", seq: 1, title: "Intro" });
  });
  const u = asUser(t, alice);

  await expect(
    u.mutation(internal.routine.tryAcquireRegeneration, { topicSlug: "hindi", lessonKey: "nope", brief: "b" }),
  ).resolves.toMatchObject({ acquired: false, reason: "no-lesson" });
  // Already superseded: reviving it would fork the supersession chain.
  await expect(
    u.mutation(internal.routine.tryAcquireRegeneration, { topicSlug: "hindi", lessonKey: "0001-intro", brief: "b" }),
  ).resolves.toMatchObject({ acquired: false, reason: "no-lesson" });
});

test("tryAcquireRegeneration refuses a run in flight, then the daily on-demand cap", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-intro", seq: 1, title: "Intro" }));
  const genId = await t.run((ctx) =>
    ctx.db.insert("generation", { topicId, status: "generating", startedAt: Date.now() }),
  );
  const u = asUser(t, alice);

  await expect(
    u.mutation(internal.routine.tryAcquireRegeneration, { topicSlug: "hindi", lessonKey: "0001-intro", brief: "b" }),
  ).resolves.toMatchObject({ acquired: false, reason: "already-generating" });

  // Settled, but the caller already spent today's on-demand run.
  await t.run((ctx) => ctx.db.patch(genId, { status: "idle", startedAt: undefined, lastManualFireAt: Date.now() }));
  await expect(
    u.mutation(internal.routine.tryAcquireRegeneration, { topicSlug: "hindi", lessonKey: "0001-intro", brief: "b" }),
  ).resolves.toMatchObject({ acquired: false, reason: "rate-limited" });
});

test("the materialised context carries the brief, the target and the revision key", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001-intro", seq: 1, title: "Intro" });
    await ctx.db.insert("lessons", { topicId, key: "0002-verbs", seq: 2, title: "Verbs" });
  });

  // No brief armed: an ordinary run sees nothing, and that null is what selects
  // "author the next lesson".
  const plain = await t.query(internal.routine.materialiseForProvider, { topicSlug: "hindi" });
  expect(plain?.regenerate).toBeNull();

  await asUser(t, alice).mutation(internal.routine.tryAcquireRegeneration, {
    topicSlug: "hindi",
    lessonKey: "0001-intro",
    brief: "simpler, please",
  });
  const armed = await t.query(internal.routine.materialiseForProvider, { topicSlug: "hindi" });
  expect(armed?.regenerate).toMatchObject({
    lessonKey: "0001-intro",
    brief: "simpler, please",
    seq: 1,
    title: "Intro",
    // One row at seq 1 today, so the replacement is revision 2.
    revision: 2,
    newKey: "0001-intro-r2",
  });
});

test("a second regeneration mints r3, counting the row it already retired", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", {
      topicId,
      key: "0001-intro",
      seq: 1,
      title: "Intro",
      supersededBy: "0001-intro-r2",
    });
    await ctx.db.insert("lessons", { topicId, key: "0001-intro-r2", seq: 1, title: "Intro" });
  });
  await asUser(t, alice).mutation(internal.routine.tryAcquireRegeneration, {
    topicSlug: "hindi",
    lessonKey: "0001-intro-r2",
    brief: "still too hard",
  });
  const armed = await t.query(internal.routine.materialiseForProvider, { topicSlug: "hindi" });
  // Two rows at seq 1 (one already retired), so the next revision is 3 and cannot
  // collide with the r2 that is already published.
  expect(armed?.regenerate).toMatchObject({ revision: 3, newKey: "0001-intro-r3" });
});

test("reportGeneration spends the brief and logs the lesson the run actually wrote", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001-intro-r2", seq: 1, title: "Intro, again" });
    // The Frontier, which this run did not touch.
    await ctx.db.insert("lessons", { topicId, key: "0007-verbs", seq: 7, title: "Verbs" });
    await ctx.db.insert("generation", {
      topicId,
      status: "generating",
      startedAt: Date.now(),
      regenerate: { lessonKey: "0001-intro", brief: "simpler" },
    });
  });

  await t.mutation(api.routine.reportGeneration, {
    secret: "test-secret",
    topicSlug: "hindi",
    outcome: "published",
    producedLesson: { key: "0001-intro-r2", title: "Intro, again" },
  });

  const gen = await t.run((ctx) => ctx.db.query("generation").unique());
  expect(gen?.status).toBe("idle");
  // Spent by the run that read it, so the next run authors normally again.
  expect(gen?.regenerate).toBeUndefined();

  // The history names the revision, not the Frontier the lookup would have found.
  const run = await t.run((ctx) => ctx.db.query("generationRuns").unique());
  expect(run).toMatchObject({ outcome: "published", producedLessonKey: "0001-intro-r2" });
});

test("requestRegeneration is owner-only and needs a non-empty brief", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-intro", seq: 1, title: "Intro" }));

  await expect(
    asUser(t, bob).action(api.routine.requestRegeneration, {
      topicSlug: "hindi",
      lessonKey: "0001-intro",
      brief: "mine now",
    }),
  ).rejects.toThrow();
  await expect(
    asUser(t, alice).action(api.routine.requestRegeneration, {
      topicSlug: "hindi",
      lessonKey: "0001-intro",
      brief: "   ",
    }),
  ).rejects.toThrow();
  // Neither refusal armed anything.
  expect(await t.run((ctx) => ctx.db.query("generation").unique())).toBeNull();
});
