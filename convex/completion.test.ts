/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// Course completion (ADR 0015, slice 1): a Topic reaches a terminal
// `status: "completed"`, put there by the teach skill (`completeCourse`, secret-
// guarded) or the owner (`endCourse`), and reopened by the owner (`reopenCourse`).
// A completed Topic is refused by the Routine's authoring gate. Tests assert at
// the Convex function seam, mirroring routine/capture/public test style.

const modules = import.meta.glob("./**/*.ts");

beforeAll(() => {
  process.env.PUBLISH_SECRET = "test-secret";
});

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title: slug, status: "active" }));
}
async function statusOf(t: ReturnType<typeof convexTest>, topicId: Id<"topics">) {
  return (await t.run((ctx) => ctx.db.get(topicId)))?.status;
}

test("completeCourse (secret-guarded) marks a Topic completed; a bad secret is refused", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");

  await expect(
    t.mutation(api.content.completeCourse, { secret: "wrong", topicSlug: "hindi" }),
  ).rejects.toThrow();
  expect(await statusOf(t, topicId)).toBe("active");

  await t.mutation(api.content.completeCourse, { secret: "test-secret", topicSlug: "hindi" });
  expect(await statusOf(t, topicId)).toBe("completed");
});

test("endCourse is owner-only: the owner completes their Topic, a Viewer/non-owner is refused", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  // The Viewer has a Share (read access) but must still be refused a write.
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: viewer }));

  await expect(asUser(t, viewer).mutation(api.content.endCourse, { topicSlug: "hindi" })).rejects.toThrow();
  await expect(asUser(t, stranger).mutation(api.content.endCourse, { topicSlug: "hindi" })).rejects.toThrow();
  expect(await statusOf(t, topicId)).toBe("active");

  await asUser(t, owner).mutation(api.content.endCourse, { topicSlug: "hindi" });
  expect(await statusOf(t, topicId)).toBe("completed");
});

test("reopenCourse (owner-only) returns a completed Topic to active", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  await asUser(t, owner).mutation(api.content.endCourse, { topicSlug: "hindi" });
  expect(await statusOf(t, topicId)).toBe("completed");

  await expect(asUser(t, stranger).mutation(api.content.reopenCourse, { topicSlug: "hindi" })).rejects.toThrow();
  expect(await statusOf(t, topicId)).toBe("completed");

  await asUser(t, owner).mutation(api.content.reopenCourse, { topicSlug: "hindi" });
  expect(await statusOf(t, topicId)).toBe("active");
});

test("endCourse refuses a seeded course — a course that hasn't started can't be completed", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  // A freshly seeded course (no Mission/Lessons yet).
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: alice, slug: "greek", title: "Greek", status: "seeded" }),
  );

  await expect(asUser(t, alice).mutation(api.content.endCourse, { topicSlug: "greek" })).rejects.toThrow();
  // Still seeded → the Routine's bootstrap can still fire it (would be stranded if
  // it had flipped to completed and then reopened to active).
  expect(await statusOf(t, topicId)).toBe("seeded");
  expect(await t.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "greek" })).toMatchObject({
    acquired: true,
    frontierKey: "(seed)",
  });
});

test("the gate refuses a completed Topic and resumes after reopen", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi");
  // A completed Frontier — the gate would otherwise acquire.
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "L1" });
    await ctx.db.insert("progress", { userId: alice, topicId, lessonKey: "0001", status: "completed" });
  });

  // While active, the gate acquires (Frontier is completed).
  expect(await t.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "hindi" })).toMatchObject({
    acquired: true,
  });
  // Reset the lock so the completed check is what blocks the next fire, not the lock.
  await t.run(async (ctx) => {
    const gen = await ctx.db.query("generation").withIndex("by_topic", (q) => q.eq("topicId", topicId)).unique();
    await ctx.db.patch(gen!._id, { status: "idle", startedAt: undefined });
  });

  // Complete the course → the gate hard-refuses before the Frontier check.
  await t.mutation(api.content.completeCourse, { secret: "test-secret", topicSlug: "hindi" });
  expect(await t.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "hindi" })).toMatchObject({
    acquired: false,
    reason: "completed",
  });

  // Reopen → authoring resumes.
  await asUser(t, alice).mutation(api.content.reopenCourse, { topicSlug: "hindi" });
  expect(await t.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "hindi" })).toMatchObject({
    acquired: true,
  });
});
