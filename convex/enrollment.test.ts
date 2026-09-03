/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { editionAccessLevel, heldLangs } from "./lib";
import { getViewableTopic } from "./topicAccess";
import type { Id } from "./_generated/dataModel";

// Self-enroll — the fifth access grant (course-publishing issue 09 / ADR 0023).
// `enrollments` grants a member their own read access to ONE free, published
// Edition; the resolver treats an enrollee ≡ a Viewer. We assert the grant at two
// seams: the resolver helpers directly (precedence + grandfather), and the reader
// query (an enrollee reads the course end-to-end). The enroll *mutation* is issue
// 13 — here rows are inserted directly to exercise the grant in isolation.

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
// A free English course with one lesson (served as a content blob). Status is
// `completed` — the enrollment grant is status-agnostic (it grandfathers even
// after unpublish); the `published` gate lives in the enroll mutation (issue 13).
async function seedFreeTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string) {
  const topicId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("topics", { ownerId, slug, title: slug, status: "completed" as const });
    const htmlStorageId = await ctx.storage.store(new Blob(["<p>en 0001</p>"], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId: id, key: "0001", seq: 1, title: "Lesson 0001", htmlStorageId });
    return id;
  });
  return topicId;
}
async function enroll(t: ReturnType<typeof convexTest>, userId: Id<"users">, topicId: Id<"topics">, lang: string) {
  await t.run((ctx) => ctx.db.insert("enrollments", { userId, topicId, lang }));
}
async function price(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, lang: string, amount: number) {
  await t.run((ctx) => ctx.db.insert("listings", { topicId, lang, amount, currency: "zar" }));
}

// ---- resolver helpers (the seam under test, direct) -------------------------

test("editionAccessLevel returns `enrolled` for a held enrollment on a free Edition", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const learner = await seedUser(t, "learner@example.com");
  const topicId = await seedFreeTopic(t, owner, "hindi");

  // No enrollment yet → a free Edition with no grant is not-found.
  await expect(
    t.run(async (ctx) => editionAccessLevel(ctx, (await ctx.db.get(topicId))!, "en", learner)),
  ).resolves.toBe("none");

  await enroll(t, learner, topicId, "en");
  await expect(
    t.run(async (ctx) => editionAccessLevel(ctx, (await ctx.db.get(topicId))!, "en", learner)),
  ).resolves.toBe("enrolled");
});

test("an enrollment is grandfathered: still `enrolled` after the Edition is later priced", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const learner = await seedUser(t, "learner@example.com");
  const topicId = await seedFreeTopic(t, owner, "hindi");
  await enroll(t, learner, topicId, "en");

  // Price the Edition the learner already joined. The enrollment check wins — no
  // price re-check — so the grandfathered learner keeps full access.
  await price(t, topicId, "en", 120000);
  await expect(
    t.run(async (ctx) => editionAccessLevel(ctx, (await ctx.db.get(topicId))!, "en", learner)),
  ).resolves.toBe("enrolled");
});

test("enrollment is per-Edition: joining `en` does not unlock another language", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const learner = await seedUser(t, "learner@example.com");
  const topicId = await seedFreeTopic(t, owner, "hindi");
  await enroll(t, learner, topicId, "en");

  // A priced `es` Edition the learner never joined → `preview`, not `enrolled`.
  await price(t, topicId, "es", 120000);
  await expect(
    t.run(async (ctx) => editionAccessLevel(ctx, (await ctx.db.get(topicId))!, "es", learner)),
  ).resolves.toBe("preview");
});

test("getViewableTopic + heldLangs treat an enrollee as a Viewer of the joined Edition", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const learner = await seedUser(t, "learner@example.com");
  const topicId = await seedFreeTopic(t, owner, "hindi");

  // Before: no topic-level visibility, no held Edition.
  await expect(t.run((ctx) => getViewableTopic(ctx, learner, "hindi"))).resolves.toBeNull();
  await expect(
    t.run(async (ctx) => [...await heldLangs(ctx, (await ctx.db.get(topicId))!, learner)]),
  ).resolves.toEqual([]);

  await enroll(t, learner, topicId, "en");
  await expect(t.run((ctx) => getViewableTopic(ctx, learner, "hindi"))).resolves.toMatchObject({ slug: "hindi" });
  await expect(
    t.run(async (ctx) => [...await heldLangs(ctx, (await ctx.db.get(topicId))!, learner)]),
  ).resolves.toEqual(["en"]);
});

// ---- reader query (the public end-to-end seam) ------------------------------

test("an enrollee reads the course through the reader: courseHeader role `enrolled`, lesson unlocked", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const learner = await seedUser(t, "learner@example.com");
  const topicId = await seedFreeTopic(t, owner, "hindi");

  // Before enrolling: a free course the learner holds nothing on → not-found.
  expect(await asUser(t, learner).query(api.content.reader.courseHeader, { topicSlug: "hindi" })).toBeNull();
  expect(await asUser(t, learner).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" })).toBeNull();

  await enroll(t, learner, topicId, "en");

  // After: reads exactly like a Viewer — role distinguishes the "Joined" badge.
  expect(await asUser(t, learner).query(api.content.reader.courseHeader, { topicSlug: "hindi" })).toMatchObject({
    role: "enrolled",
  });
  expect(await asUser(t, learner).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" })).toMatchObject({
    locked: false,
    contentUrl: expect.any(String),
  });
});

// ---- regression: the existing grants are untouched --------------------------

test("regression: the owner still reads their own course as `owner` (enrollment is additive)", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedFreeTopic(t, owner, "hindi");
  await expect(
    t.run(async (ctx) => editionAccessLevel(ctx, (await ctx.db.get(topicId))!, "en", owner)),
  ).resolves.toBe("owner");
  expect(await asUser(t, owner).query(api.content.reader.courseHeader, { topicSlug: "hindi" })).toMatchObject({
    role: "owner",
  });
});
