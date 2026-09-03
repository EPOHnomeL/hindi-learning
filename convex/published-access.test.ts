/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { editionAccessLevel, heldLangs } from "./lib";
import { getViewableTopic } from "./topicAccess";
import type { Id } from "./_generated/dataModel";

// A FREE **published** Edition reads ≡ a Viewer for any signed-in caller
// (course-publishing commit 2) — there is no join click and no grant row: the
// owner's publish IS the grant. Three properties this file pins:
//   * it is a *live* grant, not a grandfathered one (pricing the Edition takes the
//     free read away again — grandfathering is what `enrollments` is for, and that
//     grant is still honoured);
//   * it needs an account: publishing does not make a course anonymously readable
//     (that stays the Public link's job);
//   * it never outranks a real grant, so the "Shared with me" / "Purchases" /
//     "Joined" badges are unchanged.

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedFreeTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string) {
  return await t.run(async (ctx) => {
    const id = await ctx.db.insert("topics", { ownerId, slug, title: slug, status: "completed" as const });
    const htmlStorageId = await ctx.storage.store(new Blob(["<p>en 0001</p>"], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId: id, key: "0001", seq: 1, title: "Lesson 0001", htmlStorageId });
    return id;
  });
}
async function publish(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, lang: string, published = true) {
  await t.run((ctx) => ctx.db.insert("publishedEditions", { topicId, lang, published }));
}
async function price(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, lang: string) {
  await t.run((ctx) => ctx.db.insert("listings", { topicId, lang, amount: 120000, currency: "zar" }));
}
function levelFor(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, lang: string, userId: Id<"users"> | null) {
  return t.run(async (ctx) => editionAccessLevel(ctx, (await ctx.db.get(topicId))!, lang, userId));
}

test("a signed-in member reads a free published Edition as a Viewer", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const member = await seedUser(t, "member@example.com");
  const topicId = await seedFreeTopic(t, owner, "hindi");

  // Unpublished: a free course a caller holds nothing on is still not-found.
  await expect(levelFor(t, topicId, "en", member)).resolves.toBe("none");
  await expect(t.run((ctx) => getViewableTopic(ctx, member, "hindi"))).resolves.toBeNull();

  await publish(t, topicId, "en");

  await expect(levelFor(t, topicId, "en", member)).resolves.toBe("viewer");
  await expect(t.run((ctx) => getViewableTopic(ctx, member, "hindi"))).resolves.toMatchObject({ slug: "hindi" });
  await expect(
    t.run(async (ctx) => [...(await heldLangs(ctx, (await ctx.db.get(topicId))!, member))]),
  ).resolves.toEqual(["en"]);

  // End to end through the reader: the lesson body is served, not locked.
  expect(await asUser(t, member).query(api.content.reader.courseHeader, { topicSlug: "hindi" })).toMatchObject({
    role: "viewer",
  });
  expect(
    await asUser(t, member).query(api.content.reader.getLesson, { topicSlug: "hindi", key: "0001" }),
  ).toMatchObject({ locked: false, contentUrl: expect.any(String) });
});

test("unpublishing takes the free read away again", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const member = await seedUser(t, "member@example.com");
  const topicId = await seedFreeTopic(t, owner, "hindi");
  await publish(t, topicId, "en");
  await expect(levelFor(t, topicId, "en", member)).resolves.toBe("viewer");

  await asUser(t, owner).mutation(api.catalogue.setEditionPublished, {
    topicSlug: "hindi",
    lang: "en",
    published: false,
  });
  await expect(levelFor(t, topicId, "en", member)).resolves.toBe("none");
  expect(await asUser(t, member).query(api.content.reader.courseHeader, { topicSlug: "hindi" })).toBeNull();
});

test("the free read is per-Edition and price-sensitive, not grandfathered", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const member = await seedUser(t, "member@example.com");
  const topicId = await seedFreeTopic(t, owner, "hindi");
  await publish(t, topicId, "en");
  await publish(t, topicId, "es");
  await price(t, topicId, "es");

  // A published PAID Edition is bought, never read for free — only its Preview.
  await expect(levelFor(t, topicId, "es", member)).resolves.toBe("preview");

  // Pricing the English Edition ends the free read (there is no row to
  // grandfather — that is exactly what an `enrollments` grant is for).
  await price(t, topicId, "en");
  await expect(levelFor(t, topicId, "en", member)).resolves.toBe("preview");
});

test("a published language with no ready Edition grants nothing", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const member = await seedUser(t, "member@example.com");
  const topicId = await seedFreeTopic(t, owner, "hindi");
  await publish(t, topicId, "es");

  // No translation job (e.g. the Edition was removed after being listed): serving
  // it would mean English text under a Spanish label.
  await expect(levelFor(t, topicId, "es", member)).resolves.toBe("none");

  const jobId = await t.run((ctx) =>
    ctx.db.insert("translationJobs", { topicId, lang: "es", status: "translating", total: 1, done: 0, failed: 0 }),
  );
  await expect(levelFor(t, topicId, "es", member)).resolves.toBe("none");
  await t.run((ctx) => ctx.db.patch(jobId, { status: "ready" as const }));
  await expect(levelFor(t, topicId, "es", member)).resolves.toBe("viewer");
});

test("publishing needs an account: an anonymous caller still gets nothing", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedFreeTopic(t, owner, "hindi");
  await publish(t, topicId, "en");

  // Anonymous read stays the Public link's job (a bearer token), unchanged.
  await expect(levelFor(t, topicId, "en", null)).resolves.toBe("none");
  expect(await t.query(api.content.reader.courseHeader, { topicSlug: "hindi" })).toBeNull();
});

test("regression: a real grant keeps its own badge on a published course", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const joiner = await seedUser(t, "joiner@example.com");
  const topicId = await seedFreeTopic(t, owner, "hindi");
  await publish(t, topicId, "en");
  await t.run((ctx) => ctx.db.insert("entitlements", { topicId, userId: buyer, lang: "en" }));
  await t.run((ctx) => ctx.db.insert("enrollments", { topicId, userId: joiner, lang: "en" }));

  await expect(levelFor(t, topicId, "en", owner)).resolves.toBe("owner");
  await expect(levelFor(t, topicId, "en", buyer)).resolves.toBe("entitled");
  await expect(levelFor(t, topicId, "en", joiner)).resolves.toBe("enrolled");
});
