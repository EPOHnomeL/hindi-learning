/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// Deleting a course (authoring/03, decided 2026-09-21) is a hard delete guarded by
// a refuse-to-remove rule: it takes the Topic, everything keyed to it and every
// blob it owns, but only once nobody other than the owner holds it. Both halves
// are worth holding down, because getting either wrong is unrecoverable: a gap in
// the cascade orphans rows and blobs forever, and a gap in the guard destroys
// something a buyer paid for.

const modules = import.meta.glob("./**/*.ts");

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
// `userId|session` is the subject shape Convex Auth's getAuthUserId parses back.
function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

// A course with one of everything the cascade is supposed to reach, including the
// blobs: a lesson body, a reference body, a resource file, a translated lesson,
// narration audio, and an emblem image.
async function seedFullCourse(t: ReturnType<typeof convexTest>) {
  const owner = await seedUser(t, "owner@example.com");
  const blobs: Id<"_storage">[] = [];
  const topicId = await t.run(async (ctx) => {
    const blob = async (body: string) => {
      const id = await ctx.storage.store(new Blob([body], { type: "text/html" }));
      blobs.push(id);
      return id;
    };
    const emblemId = await blob("emblem");
    const id = await ctx.db.insert("topics", {
      ownerId: owner,
      slug: "hindi",
      title: "Hindi",
      status: "active",
      emblem: { imageId: emblemId },
    });
    await ctx.db.insert("lessons", { topicId: id, key: "0001-intro", seq: 1, title: "Intro", htmlStorageId: await blob("l1") });
    await ctx.db.insert("references", { topicId: id, key: "glossary", title: "Glossary", htmlStorageId: await blob("ref"), contentHash: "h" });
    await ctx.db.insert("resources", {
      topicId: id,
      ownerId: owner,
      filename: "notes.pdf",
      rawStorageId: await blob("pdf"),
      contentHash: "h2",
      status: "ready",
      kind: "file",
    });
    await ctx.db.insert("translations", {
      topicId: id,
      lang: "fr",
      kind: "lesson",
      key: "0001-intro",
      htmlStorageId: await blob("fr"),
      sourceHash: "h3",
    });
    await ctx.db.insert("lessonAudio", {
      topicId: id,
      lessonKey: "0001-intro",
      lang: "en",
      voiceId: "v",
      modelId: "m",
      storageId: await blob("mp3"),
      sampleChars: 0,
      chars: 10,
    });
    await ctx.db.insert("learningRecords", { topicId: id, key: "0001-intro", seq: 1, markdown: "# rec" });
    await ctx.db.insert("progress", { topicId: id, userId: owner, lessonKey: "0001-intro", status: "completed" });
    await ctx.db.insert("responses", { topicId: id, userId: owner, lessonKey: "0001-intro", quizId: "q1", answer: "a", correct: true });
    await ctx.db.insert("questions", { topicId: id, userId: owner, lessonKey: "0001-intro", text: "why?", status: "open" });
    await ctx.db.insert("generation", { topicId: id, status: "idle" });
    await ctx.db.insert("generationRuns", { topicId: id, outcome: "published", startedAt: 1, endedAt: 2 });
    await ctx.db.insert("publicLinks", { topicId: id, lang: "en", token: "tok" });
    await ctx.db.insert("pendingShares", { topicId: id, email: "invitee@example.com", lang: "en" });
    return id;
  });
  return { owner, topicId, blobs };
}

// Every table the cascade is responsible for, counted for one Topic.
async function remainingRows(t: ReturnType<typeof convexTest>, topicId: Id<"topics">) {
  return await t.run(async (ctx) => {
    const tables = [
      "lessons",
      "references",
      "resources",
      "translations",
      "lessonAudio",
      "learningRecords",
      "progress",
      "responses",
      "questions",
      "generation",
      "publicLinks",
      "pendingShares",
    ] as const;
    let total = 0;
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      total += rows.filter((r) => (r as { topicId?: Id<"topics"> }).topicId === topicId).length;
    }
    return total;
  });
}

test("deleteTopic removes the course, everything keyed to it, and every blob it owned", async () => {
  const t = convexTest(schema, modules);
  const { owner, topicId, blobs } = await seedFullCourse(t);
  expect(await remainingRows(t, topicId)).toBeGreaterThan(0);

  await asUser(t, owner).mutation(api.content.authoring.deleteTopic, { topicSlug: "hindi" });

  expect(await t.run((ctx) => ctx.db.get(topicId))).toBeNull();
  expect(await remainingRows(t, topicId)).toBe(0);
  // The run log survives on purpose: `routine.runHistory` renders it as a run on a
  // "(deleted course)", so the record of what authoring was spent outlives the
  // course, exactly as the Ledger does.
  expect(await t.run((ctx) => ctx.db.query("generationRuns").collect())).toHaveLength(1);
  // No orphaned bytes: a blob nobody can reach is a cost with no way back to it.
  const surviving = await t.run(async (ctx) => {
    let n = 0;
    for (const id of blobs) if (await ctx.db.system.get(id)) n++;
    return n;
  });
  expect(surviving).toBe(0);
});

test("deleteTopic refuses while a buyer holds an Edition, and destroys nothing", async () => {
  const t = convexTest(schema, modules);
  const { owner, topicId } = await seedFullCourse(t);
  const buyer = await seedUser(t, "buyer@example.com");
  await t.run((ctx) => ctx.db.insert("entitlements", { topicId, userId: buyer, lang: "en" }));

  await expect(
    asUser(t, owner).mutation(api.content.authoring.deleteTopic, { topicSlug: "hindi" }),
  ).rejects.toThrow();

  // The refusal is the whole point: the course is exactly as it was.
  expect(await t.run((ctx) => ctx.db.get(topicId))).not.toBeNull();
  expect(await remainingRows(t, topicId)).toBeGreaterThan(0);
});

test("deleteTopic refuses for a certificate, a share, or a live listing", async () => {
  const t = convexTest(schema, modules);
  const { owner, topicId } = await seedFullCourse(t);
  const other = await seedUser(t, "other@example.com");
  const u = asUser(t, owner);

  const certId = await t.run((ctx) =>
    ctx.db.insert("certificates", {
      topicId,
      userId: other,
      token: "c1",
      learnerName: "Other",
      courseTitle: "Hindi",
      lessonCount: 1,
    }),
  );
  await expect(u.mutation(api.content.authoring.deleteTopic, { topicSlug: "hindi" })).rejects.toThrow();

  await t.run((ctx) => ctx.db.delete(certId));
  const shareId = await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: other, lang: "en" }));
  await expect(u.mutation(api.content.authoring.deleteTopic, { topicSlug: "hindi" })).rejects.toThrow();

  await t.run((ctx) => ctx.db.delete(shareId));
  const listingId = await t.run((ctx) =>
    ctx.db.insert("listings", { topicId, lang: "en", amount: 1000, currency: "ZAR" }),
  );
  await expect(u.mutation(api.content.authoring.deleteTopic, { topicSlug: "hindi" })).rejects.toThrow();

  // Cleared one by one, the same course now deletes: the guard blocks, it does not
  // permanently disqualify.
  await t.run((ctx) => ctx.db.delete(listingId));
  await u.mutation(api.content.authoring.deleteTopic, { topicSlug: "hindi" });
  expect(await t.run((ctx) => ctx.db.get(topicId))).toBeNull();
});

test("a public link or an unaccepted invitation does not block the delete", async () => {
  const t = convexTest(schema, modules);
  const { owner, topicId } = await seedFullCourse(t);
  // Both are seeded by seedFullCourse: neither names somebody who holds the course
  // today, and both are already the owner's to revoke, so the delete revokes them.
  const holders = await asUser(t, owner).query(api.content.authoring.courseDeleteHolders, { topicSlug: "hindi" });
  expect(Object.values(holders!).every((n) => n === 0)).toBe(true);
  await asUser(t, owner).mutation(api.content.authoring.deleteTopic, { topicSlug: "hindi" });
  expect(await t.run((ctx) => ctx.db.get(topicId))).toBeNull();
});

test("only the owner can delete, or see the holder counts", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await seedFullCourse(t);
  const stranger = await seedUser(t, "stranger@example.com");

  await expect(
    asUser(t, stranger).mutation(api.content.authoring.deleteTopic, { topicSlug: "hindi" }),
  ).rejects.toThrow();
  expect(
    await asUser(t, stranger).query(api.content.authoring.courseDeleteHolders, { topicSlug: "hindi" }),
  ).toBeNull();
  expect(await t.run((ctx) => ctx.db.get(topicId))).not.toBeNull();
});

test("courseDeleteHolders names each kind of holder the owner has to clear", async () => {
  const t = convexTest(schema, modules);
  const { owner, topicId } = await seedFullCourse(t);
  const buyer = await seedUser(t, "buyer@example.com");
  await t.run(async (ctx) => {
    await ctx.db.insert("entitlements", { topicId, userId: buyer, lang: "en" });
    await ctx.db.insert("entitlements", { topicId, userId: owner, lang: "fr" });
    await ctx.db.insert("listings", { topicId, lang: "en", amount: 1000, currency: "ZAR" });
  });

  const holders = await asUser(t, owner).query(api.content.authoring.courseDeleteHolders, { topicSlug: "hindi" });
  expect(holders).toMatchObject({ buyers: 2, listings: 1, certificates: 0, viewers: 0, learners: 0 });
});
