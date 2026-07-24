/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

// scheduleInvite now builds links via appUrl, which requires SITE_URL (issue 12).
process.env.SITE_URL = "https://app.example.com";

// `userId|session` is the subject shape Convex Auth's getAuthUserId parses back.
function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string, title: string) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title, status: "active" }));
}

test("a Viewer reads the Lessons of a Topic shared with them", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" }));

  // Before the Share, the Viewer sees nothing.
  expect(await asUser(t, viewer).query(api.content.reader.listLessons, { topicSlug: "hindi" })).toEqual([]);

  // The owner shares the Topic to the Viewer's account email.
  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "viewer@example.com" });

  // Now the Viewer reads the owner's Lessons.
  const lessons = await asUser(t, viewer).query(api.content.reader.listLessons, { topicSlug: "hindi" });
  expect(lessons.map((l) => l.key)).toEqual(["0001-a"]);
});

test("a Viewer reads a single Lesson and the References of a shared Topic", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  const { lessonSid, refSid } = await t.run(async (ctx) => {
    const lessonSid = await ctx.storage.store(new Blob(["<p>lesson</p>"], { type: "text/html" }));
    const refSid = await ctx.storage.store(new Blob(["<p>ref</p>"], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A", htmlStorageId: lessonSid });
    await ctx.db.insert("references", { topicId, key: "grammar", title: "Grammar", htmlStorageId: refSid, contentHash: "h" });
    return { lessonSid, refSid };
  });
  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "viewer@example.com" });

  const as = asUser(t, viewer);
  expect(await as.query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001-a" })).toMatchObject({ key: "0001-a", contentUrl: expect.stringContaining(`/content?id=${lessonSid}`) });
  expect(await as.query(api.content.reader.listReferences, { topicSlug: "hindi" })).toMatchObject([{ key: "grammar", title: "Grammar" }]);
  expect(await as.query(api.content.reader.getReference, { topicSlug: "hindi", key: "grammar" })).toMatchObject({ key: "grammar", contentUrl: expect.stringContaining(`/content?id=${refSid}`) });
});

test("a non-Viewer (no Share) still sees nothing of the Topic", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" }));
  // Share with the Viewer only.
  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "viewer@example.com" });

  const asStranger = asUser(t, stranger);
  expect(await asStranger.query(api.content.reader.listLessons, { topicSlug: "hindi" })).toEqual([]);
  expect(await asStranger.query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001-a" })).toBeNull();
});

test("the owner still reads their own Topic after sharing it", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" }));
  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "viewer@example.com" });

  const lessons = await asUser(t, owner).query(api.content.reader.listLessons, { topicSlug: "hindi" });
  expect(lessons.map((l) => l.key)).toEqual(["0001-a"]);
});

test("listSharedTopics returns Topics shared with the caller, attributed to the owner", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run(async (ctx) => {
    await ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A" });
    await ctx.db.insert("lessons", { topicId, key: "0002-b", seq: 2, title: "B" });
    // The owner completed both, but counts on the shared card are the Viewer's own.
    await ctx.db.insert("progress", { userId: owner, topicId, lessonKey: "0001-a", status: "completed" });
    await ctx.db.insert("progress", { userId: owner, topicId, lessonKey: "0002-b", status: "completed" });
    // The Viewer has completed one of the two.
    await ctx.db.insert("progress", { userId: viewer, topicId, lessonKey: "0001-a", status: "completed" });
  });
  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "viewer@example.com" });

  // The Viewer sees the shared Topic, attributed to the owner, with THEIR OWN counts.
  const shared = await asUser(t, viewer).query(api.shares.listSharedTopics, {});
  expect(shared).toMatchObject([
    { slug: "hindi", title: "Hindi", ownerEmail: "owner@example.com", lessonCount: 2, completedCount: 1 },
  ]);

  // A stranger sees nothing shared with them.
  expect(await asUser(t, stranger).query(api.shares.listSharedTopics, {})).toEqual([]);
  // The owner's own Topics never appear in their "Shared with me".
  expect(await asUser(t, owner).query(api.shares.listSharedTopics, {})).toEqual([]);
});

test("sharing to a registered account grants a Share immediately (no pending invite)", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  await seedUser(t, "viewer@example.com");
  await seedTopic(t, owner, "hindi", "Hindi");

  const status = await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "viewer@example.com" });
  expect(status).toBe("shared");
  // Nothing is left waiting — the account already existed.
  expect(await t.run((ctx) => ctx.db.query("pendingShares").collect())).toEqual([]);
});

test("sharing to an email with no account yet records a pending invite, not an error", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  await seedTopic(t, owner, "hindi", "Hindi");

  // Different casing on the second invite — normalisation means it's the same
  // person, so the invite is idempotent (one pending row, not two).
  const status = await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "Future@Example.com" });
  expect(status).toBe("pending");
  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "future@example.com" });

  const pending = await t.run((ctx) =>
    ctx.db.query("pendingShares").withIndex("by_email", (q) => q.eq("email", "future@example.com")).collect(),
  );
  expect(pending.length).toBe(1);
});

test("shareTopic is owner-only: a non-owner cannot share someone else's Topic", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const target = await seedUser(t, "target@example.com");
  await seedTopic(t, owner, "hindi", "Hindi");

  // The stranger doesn't own "hindi", so they can't share it (even to a real account).
  await expect(
    asUser(t, stranger).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "target@example.com" }),
  ).rejects.toThrow();
});
